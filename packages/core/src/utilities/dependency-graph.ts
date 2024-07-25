import semver from 'semver';
import chalk from 'chalk';
import { Packages, Package } from '@manypkg/get-packages';
import { warn } from 'evem-logger';
import { PackageJSON, DEPENDENCY_TYPES, VersionContext } from '../types';

/**
 * Get packages that exist in the workspace, ignoring link and file linking methods.
 */
const getAllDependencies = (config: PackageJSON, versionContext: VersionContext) => {
  const allDependencies = new Map<string, string>();

  for (const type of DEPENDENCY_TYPES) {
    const deps = config[type];
    if (!deps) continue;

    for (const name of Object.keys(deps)) {
      const depRange = deps[name];
      if (
        (depRange.startsWith('link:') ||
          depRange.startsWith('file:') ||
          versionContext.ignoreDevDependencies) &&
        type === 'devDependencies'
      ) {
        continue;
      }
      allDependencies.set(name, depRange);
    }
  }

  return allDependencies;
};

const isProtocolRange = (range: string) => range.indexOf(':') !== -1;

const getValidRange = (potentialRange: string) => {
  if (isProtocolRange(potentialRange)) {
    return null;
  }

  try {
    return new semver.Range(potentialRange);
  } catch {
    return null;
  }
};

/**
 * Get the relationship diagram of each package and its dependencies.
 */
export function getDependencyGraph(
  packages: Packages,
  versionContext: VersionContext,
  silent?: boolean
): {
  graph: Map<string, { pkg: Package; dependencies: Array<string> }>;
  valid: boolean;
} {
  const graph = new Map<string, { pkg: Package; dependencies: Array<string> }>();
  let valid = true;

  const packagesByName: { [key: string]: Package } = {};
  const queue: Package[] = [];

  // rush don't have root
  if (packages.rootPackage) {
    packagesByName[packages.rootPackage.packageJson.name] = packages.rootPackage;
    queue.push(packages.rootPackage);
  }

  for (const pkg of packages.packages) {
    queue.push(pkg);
    packagesByName[pkg.packageJson.name] = pkg;
  }

  for (const pkg of queue) {
    const { name } = pkg.packageJson;
    const dependencies: string[] = [];
    const allDependencies = getAllDependencies(pkg.packageJson, versionContext);

    // eslint-disable-next-line prefer-const
    for (let [depName, depRange] of allDependencies) {
      const match = packagesByName[depName];
      if (!match) continue;

      const expected = match.packageJson.version;
      const usesWorkspaceRange = depRange.startsWith('workspace:');

      if (usesWorkspaceRange) {
        depRange = depRange.replace(/^workspace:/, '');
        if (depRange === '*' || depRange === '^' || depRange === '~') {
          dependencies.push(depName);
          continue;
        }
      } else if (versionContext?.bumpVersionsWithWorkspaceProtocolOnly) {
        continue;
      }

      const range = getValidRange(depRange);

      if ((range && !range.test(expected)) || isProtocolRange(depRange)) {
        valid = false;
        // Print a log reminder for those dependencies that depend on local packages but have mismatched versions.
        !silent &&
          warn(
            `Package ${chalk.cyan(`"${name}"`)} must depend on the current version of ${chalk.cyan(
              `"${depName}"`
            )}: ${chalk.green(`"${expected}"`)} vs ${chalk.red(`"${depRange}"`)}`
          );
        continue;
      }

      // `depRange` could have been a tag and if a tag has been used there might have been a reason for that
      // we should not count this as a local monorepo dependant
      if (!range) {
        continue;
      }

      dependencies.push(depName);
    }

    graph.set(name, { pkg, dependencies });
  }
  return { graph, valid };
}

/**
 * Get the downstream dependency relationship diagram for each package.
 */

export function getDependentsGraph(packages: Packages, versionContext: VersionContext, silent?: boolean) {
  const graph = new Map<string, { pkg: Package; dependents: string[] }>();
  const { graph: dependencyGraph } = getDependencyGraph(packages, versionContext, silent);

  const dependentsLookup: Record<string, { pkg: Package; dependents: string[] }> = {};

  for (const pkg of packages.packages) {
    dependentsLookup[pkg.packageJson.name] = { pkg, dependents: [] };
  }

  for (const pkg of packages.packages) {
    const dependent = pkg.packageJson.name;
    const { dependencies = [] } = dependencyGraph.get(dependent) || {};

    for (const dependency of dependencies) {
      dependentsLookup[dependency].dependents.push(dependent);
    }
  }

  for (const [pkgName, pkgInfo] of Object.entries(dependentsLookup)) {
    graph.set(pkgName, pkgInfo);
  }

  const simplifiedDependentsGraph = new Map<string, string[]>();

  for (const [pkgName, { dependents }] of graph) {
    simplifiedDependentsGraph.set(pkgName, dependents);
  }

  return simplifiedDependentsGraph;
}

/**
 * Sort the packages in dependency order.
 */
export function sortPackagesByDependencyOrder(packages: Package[]) {
  const graph: Map<string, Map<string, string>> = new Map();
  const visited = new Map<string, boolean>();
  const temp = new Map<string, boolean>();
  const result: Package[] = [];

  // Build graph
  for (const pkg of packages) {
    const deps = new Map<string, string>();

    DEPENDENCY_TYPES.forEach((depType) => {
      for (const [name, version] of Object.entries(pkg.packageJson[depType] || {})) {
        if (packages.find((l) => l.packageJson.name === name)) {
          deps.set(name, version);
        }
      }
    });

    graph.set(pkg.packageJson.name, deps);
  }

  function visitNode(node: string, memo: Map<string, boolean>, stack: string[]) {
    if (memo.has(node)) {
      return;
    }
    if (temp.has(node)) {
      warn(chalk.red(`Circular dependency detected: ${[...stack, node].join(' -> ')}`));
      return;
    }
    temp.set(node, true);

    for (const [dep] of graph.get(node)!) {
      visitNode(dep, memo, [...stack, node]);
    }
    temp.delete(node);
    memo.set(node, true);
    result.unshift(packages.find((pkg) => pkg.packageJson.name === node)!);
  }

  // Traverse graph
  for (const node of graph.keys()) {
    visitNode(node, visited, []);
  }

  return result.reverse();
}
