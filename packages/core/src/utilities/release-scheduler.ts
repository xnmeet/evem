import { Packages, Package } from '@manypkg/get-packages';
import { JsonFile, JsonSchema } from '@rushstack/node-core-library';
import semver, { ReleaseType } from 'semver';
import { warn, debug } from 'evem-logger';
import lodash from 'lodash';
import micromatch from 'micromatch';

import { ChangeFilesManage } from '../change-file';
import schemaJson from '../schemas/change-file.schema.json';
import { typeOrder } from './constant';
import { VersionUtilities } from './version';
import {
  DependencyType,
  PackageJSON,
  DependencyVersionRange,
  UpdatedVersionPlan,
  ChangeType,
  IChangeInfo,
  ReleasePlan,
  VersionType,
  DEPENDENCY_TYPES,
  VersionContext
} from '../types';

export class ReleaseScheduler {
  /**
   * To obtain the change request the package and release list
   * that needs to be changed will be calculated according to
   * the changes directory or the specified package.
   */
  public static findChangeRequests(
    packages: Packages,
    changeFiles: ChangeFilesManage,
    versionContext: VersionContext,
    consumingPackages: Map<string, string[]>,
    targetPackages?: string[]
  ): Map<string, ReleasePlan> {
    // Create a package map indexed by name
    const packagesByName: Map<string, Package> = new Map(
      packages.packages.map((x) => [x.packageJson.name, x])
    );

    const packageChanges = this.getPackageChanges(changeFiles, packagesByName);
    // Translate the glob declaration into specific package names
    // noting that the versionContext.fixed has been changed here.
    versionContext.fixed = this.getFixedPackageGroup(packagesByName, versionContext);

    const releasesPlan = this.flattenReleases(packageChanges, packagesByName, versionContext);
    if (!releasesPlan.size) return releasesPlan;

    let redefineTargetPackages: string[] = [];

    // Recalculate the specified publishing list
    if (targetPackages.length) {
      // console.log(releasesPlan);
      for (const toName of targetPackages) {
        if (releasesPlan.has(toName) && releasesPlan.get(toName)?.versionType !== 'none') {
          redefineTargetPackages.push(toName);
          for (const f of versionContext.fixed) {
            if (f.includes(toName)) {
              redefineTargetPackages.push(...f);
            }
          }
        }
      }

      redefineTargetPackages = this.genRedefineTargetPackages(
        packagesByName,
        releasesPlan,
        versionContext,
        consumingPackages,
        redefineTargetPackages,
        targetPackages
      );
    }

    const releasePlan = this.generateReleasePlan(
      releasesPlan,
      packagesByName,
      consumingPackages,
      versionContext
    );

    if (targetPackages.length) {
      // Filter the release plan according to the specified release list
      if (redefineTargetPackages.length) {
        for (const [name] of releasePlan) {
          if (
            !redefineTargetPackages.includes(name) &&
            !this.isHitFixedGroup(name, releasePlan, versionContext, redefineTargetPackages)
          ) {
            releasePlan.delete(name);
          }
        }
      } else {
        releasePlan.clear();
      }
    }

    // Calculate the release order to ensure that it is released after downstream dependency.
    this.calculateReleaseOrder(releasePlan, consumingPackages);

    return releasePlan;
  }

  /**
   * Generate the target package to be released (for target mode)
   * @param packagesByName Package map indexed by name
   * @param releasesPlan Release plan
   * @param versionContext Affect the context of version calculation
   * @param consumingPackages List of downstream consumption
   * @param targetPackages targetPackages
   * @returns redefineTargetPackages
   */
  private static genRedefineTargetPackages(
    packagesByName: Map<string, Package>,
    releasesPlan: Map<string, ReleasePlan>,
    versionContext: VersionContext,
    consumingPackages: Map<string, string[]>,
    redefineTargetPackages: string[],
    targetPackages?: string[]
  ): string[] {
    // Translate the glob declaration into specific package names
    // noting that the versionContext.fixed has been changed here.
    versionContext.fixed = this.getFixedPackageGroup(packagesByName, versionContext);

    // Recalculate the specified publishing list
    if (targetPackages.length) {
      for (const toName of targetPackages) {
        if (releasesPlan.has(toName) && releasesPlan.get(toName)?.versionType !== 'none') {
          redefineTargetPackages.push(toName);
          for (const f of versionContext.fixed) {
            if (f.includes(toName)) {
              redefineTargetPackages.push(...f);
            }
          }
        }
      }

      if (!versionContext.independent) {
        function addConsumePkgs(pkgs: string[]) {
          pkgs.forEach((pkg) => {
            if (redefineTargetPackages.includes(pkg)) {
              return;
            }

            redefineTargetPackages.push(pkg);

            const consumePkgs = consumingPackages.get(pkg);
            if (consumePkgs) {
              addConsumePkgs(consumePkgs);
            }
          });
        }

        redefineTargetPackages.forEach((l) => {
          const consumePkgs = consumingPackages.get(l);
          if (consumePkgs) {
            addConsumePkgs(consumePkgs);
          }
        });
      }

      redefineTargetPackages = [...new Set(redefineTargetPackages)];
    }

    return redefineTargetPackages;
  }
  /**
   * Whether it hits the fixed package group.
   * @param currentPackageName Package name to be detected.
   * @param releasePlan Release plan
   * @param versionContext Affect the context of version calculation
   * @param targetPackages The specified package to be published
   * @returns Whether it is within the fixed list group.
   */
  public static isHitFixedGroup(
    currentPackageName: string,
    releasePlan: Map<string, ReleasePlan>,
    versionContext: VersionContext,
    targetPackages: string[]
  ): boolean {
    for (const group of versionContext.fixed) {
      if (group.includes(currentPackageName)) {
        let hintGroup = false;

        for (const packageName of group) {
          if (releasePlan.get(packageName) && targetPackages.includes(packageName)) {
            hintGroup = true;
            break;
          }
        }

        if (hintGroup) return hintGroup;
      }
    }

    return false;
  }

  /**
   * Read the change file and obtain the corresponding change log for the registration.
   * @param changeFiles ChangeFilesManage instance
   * @param packagesByName Aggregated package by package name
   * @returns ChangeInfo corresponding to each package.
   */
  public static getPackageChanges(
    changeFiles: ChangeFilesManage,
    packagesByName: Map<string, Package>
  ): Map<string, IChangeInfo> {
    const packageChanges = new Map<string, IChangeInfo>();

    debug(`Finding changes in: ${changeFiles.getChangesPath()}`);

    const files: string[] = changeFiles.getFiles();
    const schema: JsonSchema = JsonSchema.fromLoadedObject(schemaJson);
    // Avoid printing multiple warning messages
    const invalidChanges = new Set<string>();
    // Add the minimum changes defined by the change descriptions.
    for (const changeFilePath of files) {
      const changeRequest: IChangeInfo = JsonFile.loadAndValidate(changeFilePath, schema);
      if (!changeRequest || !changeRequest.changes) {
        throw new Error(`Invalid change file: ${changeFilePath}`);
      }

      const { packageName } = changeRequest;

      const tryGetPackage = !!packagesByName.get(packageName);

      if (!tryGetPackage) {
        if (!invalidChanges.has(packageName)) {
          warn(
            `The package ${packageName} was requested for publishing but does not exist. Skip this change.`
          );
          invalidChanges.add(packageName);
        }
        continue;
      }

      const packageChange = packageChanges.get(packageName);
      const changes = changeRequest.changes!.map((c) => {
        return {
          ...c,
          changeType: ChangeType[c.type!]
        };
      });
      // initialization packageChange
      if (packageChange) {
        packageChanges.set(packageName, {
          ...packageChange,
          changes: packageChange.changes!.concat(changes ?? [])
        });
      } else {
        packageChanges.set(packageName, {
          ...changeRequest,
          order: 0,
          changes
        });
      }
    }

    return packageChanges;
  }

  /**
   * Calculate the release order relationship
   * This function changes data on the original release plan
   * @param releasePlan Release plan
   * @param consumingPackages List of downstream consumption
   */
  public static calculateReleaseOrder(
    releasePlan: Map<string, ReleasePlan>,
    consumingPackages: Map<string, string[]>
  ) {
    for (const [name, planInfo] of releasePlan) {
      const deps = consumingPackages.get(name);
      if (deps) {
        for (const dep of deps) {
          const depChange = releasePlan.get(dep);
          if (depChange) {
            depChange.changeInfo.order = Math.max(
              planInfo.changeInfo.order! + 1,
              depChange.changeInfo.order!
            );
          }
        }
      }
    }
  }

  /**
   * Given the changes hash, flattens them into a sorted array based on their dependency order.
   * @params packageChanges - hash of change requests.
   * @returns Sorted array of change requests.
   */
  public static sortChangeRequests(packageChanges: Map<string, ReleasePlan>): ReleasePlan[] {
    return [...packageChanges.values()].sort((a, b) =>
      a.changeInfo.order! === b.changeInfo.order!
        ? a.name.localeCompare(b.name)
        : a.changeInfo.order! < b.changeInfo.order!
        ? -1
        : 1
    );
  }

  /**
   * Calculate the version that needs to be upgraded for a single release plan
   * @param release Information to be released
   * @param preName Pre-release version name
   * @returns Calculated version
   */
  public static incrementVersion(release: ReleasePlan, preName: string | undefined): string {
    const { oldVersion } = release;
    if (release.versionType === 'none') {
      return oldVersion;
    }

    const version = semver.inc(oldVersion, release.versionType)!;
    if (preName) {
      // Accept the manually specified version number
      const isExactVersion = preName.split('.').length > 1;
      if (isExactVersion) return `${version}-${preName}`;

      let releaseType: ReleaseType = 'prerelease';
      switch (release.versionType) {
        case 'minor':
          releaseType = 'preminor';
          break;
        case 'major':
          releaseType = 'premajor';
          break;
        default:
          break;
      }
      const prereleaseVersion = semver.prerelease(oldVersion);

      const incVersion = semver.inc(oldVersion, releaseType, preName) as string;
      if (!prereleaseVersion) return incVersion!;

      const formalVersionInc = semver.coerce(incVersion)?.version;
      if (formalVersionInc !== version) {
        const [oldPrefix, odlNum] = prereleaseVersion;
        const [newPrefix, newNum] = semver.prerelease(incVersion);

        if (newPrefix !== oldPrefix) {
          return `${version}-${newPrefix}.${newNum}`;
        }
        return `${version}-${oldPrefix}.${Number.isNaN(Number(odlNum)) ? 0 : Number(odlNum) + 1}`;
      }
      return incVersion;
    }
    return version;
  }

  /**
   * Aggregate all changes from the changesets file and
   * correct the change type to the top-level field.
   * @param changes All changes read from the changes directory
   * @param packagesByName All package information indexed by package name
   * @param versionContext Affect the context of version calculation
   * @returns Plan to be published indexed by package name
   */
  public static flattenReleases(
    changes: Map<string, IChangeInfo>,
    packagesByName: Map<string, Package>,
    versionContext: VersionContext
  ): Map<string, ReleasePlan> {
    const releases: Map<string, ReleasePlan> = new Map();

    for (const [packageName, changeInfo] of changes) {
      for (const { type } of changeInfo.changes || []) {
        let release = releases.get(packageName);
        const pkg = packagesByName.get(packageName);

        if (!pkg) {
          throw new Error(`got changes for package "${packageName}" but such a package could not be found.`);
        }
        if (!release) {
          release = {
            name: packageName,
            oldVersion: pkg.packageJson.version,
            versionType: type as VersionType,
            changeInfo,
            // The value here is several values except for dependency.
            changeType: ChangeType[type as string]
          };
        } else {
          // Update the changed version to the highest type
          if (typeOrder[type as VersionType] > typeOrder[release.versionType]) {
            release.versionType = type!;
            release.changeType = ChangeType[type as string];
          }
        }
        // This refers to the processing of the preview version of the change release for the none type.
        // In this case, it is more necessary to force the specification of type as patch.
        if (versionContext.preName && versionContext.onlyNone) {
          // Reverse all types
          if (release.versionType === 'none') release.versionType = 'patch';
          else release.versionType = 'none';
        }

        releases.set(packageName, release as ReleasePlan);
      }
    }

    return releases;
  }

  public static detectPackageDependencies({
    releases,
    packagesByName,
    dependencyGraph,
    versionContext
  }: {
    releases: Map<string, ReleasePlan>;
    packagesByName: Map<string, Package>;
    dependencyGraph: Map<string, string[]>;
    versionContext: VersionContext;
  }) {
    // NOTE this is intended to be called recursively
    const pkgsToSearch = [...releases.values()];
    const { preName, onlyUpdatePeerDependentsWhenOutOfRange } = versionContext;

    while (pkgsToSearch.length > 0) {
      // nextRelease is our dependency, think of it as "avatar"
      const nextRelease = pkgsToSearch.shift();
      if (!nextRelease) continue;
      // pkgDependents will be a list of packages that depend on nextRelease ie. ['avatar-group', 'comment']
      const pkgDependents = dependencyGraph.get(nextRelease.name);
      if (!pkgDependents) {
        throw new Error(
          `Error in determining dependents - could not find package in repository: ${nextRelease.name}`
        );
      }

      // Traverse all downstream dependencies that depend on the current release
      for (const dependent of pkgDependents) {
        let type: VersionType | undefined;

        const dependentPackage = packagesByName.get(dependent);
        if (!dependentPackage) throw new Error('Dependency map is incorrect');

        const dependencyVersionRanges = this.getDependencyVersionRanges(
          dependentPackage.packageJson,
          nextRelease
        );

        // Start calculating the change type for the actual dependent depType
        for (const { depType, versionRange } of dependencyVersionRanges) {
          // This situation will not affect the version and can be ignored.
          if (nextRelease.versionType === 'none') {
            continue;
          } else if (
            // 这里主要是对  peerDependencies 升级的判断，是 peerDependencies 依赖的当前 nextReleas 情况
            this.shouldBumpMajor({
              dependent,
              depType,
              versionRange,
              releases,
              nextRelease,
              preName,
              onlyUpdatePeerDependentsWhenOutOfRange
            })
          ) {
            type = 'major';
          } else if (
            // Originally, it was not in the release list or did not need to be released for the time being
            // but the version upgrade caused by the dependent update does not match the current version.
            (!releases.has(dependent) || releases.get(dependent)!.versionType === 'none') &&
            // For versionRange is ^1.1.1, and the new dependent version is 1.1.3, the version is still applicable.
            // There is no need to calculate the update, but the prerelease always needs to be updated.
            !semver.satisfies(this.incrementVersion(nextRelease, preName), versionRange)
          ) {
            switch (depType) {
              case 'devDependencies':
                if (versionContext.ignoreDevDependencies) {
                  // We don't need a version bump if the package is only in the devDependencies of the dependent package
                  type = 'none';
                } else {
                  type = 'patch';
                }

                break;
              default:
                // for other three types
                type = 'patch';
                break;
            }
          }
        }

        // If the calculated version exists in the list to be released
        // and the version is the same, it can be changed to undefined and filtered out.
        // There is no need to look for it again.
        if (releases.has(dependent) && releases.get(dependent)!.versionType === type) {
          type = undefined;
        }

        if (!type) {
          continue;
        }
        // At this point, we know if we are making a change

        const dependentPkgJSON = dependentPackage.packageJson;

        const existing = releases.get(dependent);
        // For things that are being given a major bump, we check if we have already
        // added them here. If we have, we update the existing item instead of pushing it on to search.
        // It is safe to not add it to pkgsToSearch because it should have already been searched at the
        // largest possible bump type.

        if (existing && type === 'major' && existing.versionType !== 'major') {
          // If it is already in the pending release list, but the version is not the highest
          // add it again for the next calculation to see if it will affect other versions.
          // Because the lowest point here is patch.
          existing.versionType = 'major';

          pkgsToSearch.push(existing);
        } else {
          // It shows that the affected downstream dependencies calculated from the change file need to be updated.
          // These are those that do not appear in the changes directory.
          const newDependent: ReleasePlan = {
            name: dependent,
            versionType: type,
            oldVersion: dependentPkgJSON.version,
            changeInfo: existing?.changeInfo || {
              changes: [],
              packageName: dependent,
              order: 0
            },
            // This situation is a version update caused by dependency changes.
            changeType: ChangeType.dependency
          };

          // Put in pkgsToSearch and continue to calculate the downstream dependency of his influence.
          pkgsToSearch.push(newDependent);
          releases.set(dependent, newDependent);
        }
      }
    }
  }

  /**
   * Find the version range used for the dependency (dependencyRelease) in the JSON file
   * of the current package (dependentPkgJSON).
   * @param dependentPkgJSON The current package json information to be calculated
   * @param dependencyRelease Dependent packages to be released
   * @returns Contains dependency types (dep, devDep..) And the array of version range
   */
  public static getDependencyVersionRanges(
    dependentPkgJSON: PackageJSON,
    dependencyRelease: ReleasePlan
  ): DependencyVersionRange[] {
    const dependencyVersionRanges: DependencyVersionRange[] = [];

    for (const type of DEPENDENCY_TYPES) {
      const versionRange = dependentPkgJSON[type]?.[dependencyRelease.name];
      if (!versionRange) continue;

      // The dependency declaration for the workspaces type is only workspace:*,
      // which is always consistent with the original version, and the rest returns the workspace:

      // Non-workspace cases return the actual declared version number and so on.
      if (versionRange.startsWith('workspace:')) {
        dependencyVersionRanges.push({
          depType: type,
          versionRange:
            versionRange === 'workspace:*'
              ? dependencyRelease.oldVersion
              : versionRange.replace(/^workspace:/, '')
        });
      } else {
        dependencyVersionRanges.push({
          depType: type,
          versionRange
        });
      }
    }
    return dependencyVersionRanges;
  }

  public static shouldBumpMajor({
    dependent,
    depType,
    versionRange,
    releases,
    nextRelease,
    preName,
    onlyUpdatePeerDependentsWhenOutOfRange
  }: {
    dependent: string;
    depType: DependencyType;
    versionRange: string;
    releases: Map<string, ReleasePlan>;
    nextRelease: ReleasePlan;
    preName: string | undefined;
    onlyUpdatePeerDependentsWhenOutOfRange?: boolean;
  }) {
    // we check if it is a peerDependency because if it is, our dependent bump type might need to be major.
    return (
      depType === 'peerDependencies' &&
      nextRelease.versionType !== 'none' &&
      nextRelease.versionType !== 'patch' &&
      // 1. If onlyUpdatePeerDependentsWhenOutOfRange set to true, bump major if the version is leaving the range.
      // 2. If onlyUpdatePeerDependentsWhenOutOfRange set to false, bump major regardless whether or not the version is leaving the range.
      (!onlyUpdatePeerDependentsWhenOutOfRange ||
        !semver.satisfies(this.incrementVersion(nextRelease, preName), versionRange)) &&
      // bump major only if the dependent doesn't already has a major release.
      (!releases.has(dependent) ||
        (releases.has(dependent) && releases.get(dependent)!.versionType !== 'major'))
    );
  }

  /**
   * Get the new version number
   * @param release Content to be published
   * @param preName Preview version name
   * @returns newVersion
   */
  public static getNewVersion(release: ReleasePlan, versionContext: VersionContext): string {
    if (release.versionType === 'none') {
      return release.oldVersion;
    }
    return this.incrementVersion(release, versionContext.preName);
  }

  /**
   * Get the content that needs to be published
   * @param releasesPlan List of releases to be calculated
   * @param packagesByName  All package information
   * @param dependencyGraph Downstream dependency diagram
   * @param versionContext The version first closes the context.
   * @returns Items to be released
   */
  public static generateReleasePlan(
    releasesPlan: Map<string, ReleasePlan>,
    packagesByName: Map<string, Package>,
    dependencyGraph: Map<string, string[]>,
    versionContext: VersionContext
  ): Map<string, ReleasePlan> {
    // Get the original value repeatedly to compare it with the calculation
    // because some original information will be lost after the calculation
    // and it can't be filtered.
    const originReleases = lodash.cloneDeep(releasesPlan);
    let needDetectAgain = false;

    while (!needDetectAgain) {
      // The map passed in to detectPackageDependencies will be mutated
      this.detectPackageDependencies({
        releases: releasesPlan,
        packagesByName,
        dependencyGraph,
        versionContext
      });
      needDetectAgain = !this.unifiedFixedVersion(releasesPlan, packagesByName, versionContext);
    }

    const isOnlyNone = versionContext.preName && versionContext.onlyNone;

    for (const [name, incompleteRelease] of releasesPlan) {
      const originJson = packagesByName.get(name).packageJson;
      // For those packages that are declared as of type none, there will be no version update.
      // But it needs to be handled separately for isOnlyNone mode.
      const shouldSkip = isOnlyNone
        ? !(
            incompleteRelease.changeType === ChangeType.dependency ||
            incompleteRelease.versionType === 'patch'
          )
        : originReleases.get(name)?.versionType === 'none' &&
          // If it is a change caused by a fixed version, it should not be skipped.
          incompleteRelease?.oldVersion === originJson.version;

      const newVersion = shouldSkip
        ? originJson.version
        : this.getNewVersion(incompleteRelease, versionContext);

      releasesPlan.set(name, {
        ...incompleteRelease,
        newVersion,
        // Reset the old version, because there will be changes in the unifiedFixedVersion process
        // resulting in incorrect display information.
        oldVersion: originJson.version
      });
    }
    return releasesPlan;
  }

  /**
   * Calculate the dependent version and update it to the package.json file of the relevant package
   * @param releases List to be released
   * @param packages All package information
   * @param consumingPackages consumePackages - used to ensure is should to update version ro json
   * @param versionContext Version-related context
   * @returns List of packages to be updated for package.json
   */
  public static updateDependentVersion(
    releases: ReleasePlan[],
    packagesByName: Map<string, Package>,
    consumingPackages: Map<string, string[]>,
    versionContext: VersionContext
  ): UpdatedVersionPlan[] {
    const updatedRelease: UpdatedVersionPlan[] = [];
    const { onlyUpdatePeerDependentsWhenOutOfRange = false, bumpVersionsWithWorkspaceProtocolOnly } =
      versionContext;

    for (const release of releases) {
      // 判断是否需要做写文件的操作
      let hasChange = false;
      const { newVersion, name: packageName, oldVersion } = release;
      const packageInfo = packagesByName.get(packageName);
      const packageJson = lodash.cloneDeep(packageInfo?.packageJson) as PackageJSON;

      packageJson.version = newVersion!;
      if (oldVersion !== newVersion) {
        hasChange = true;
      }

      for (const depType of DEPENDENCY_TYPES) {
        const deps = packageJson[depType];

        if (deps) {
          for (const dependency of releases) {
            const { name, newVersion = '', versionType } = dependency;

            let depCurrentVersion = deps[name];
            // Packages beyond the scope of version support and packages such as links will not be updated.
            if (
              !depCurrentVersion ||
              depCurrentVersion.startsWith('file:') ||
              depCurrentVersion.startsWith('link:') ||
              !VersionUtilities.shouldUpdateDependencyBasedOnConfig({
                version: newVersion,
                type: versionType,
                depVersionRange: depCurrentVersion,
                depType,
                onlyUpdatePeerDependentsWhenOutOfRange
              })
            ) {
              continue;
            }

            const usesWorkspaceRange = depCurrentVersion.startsWith('workspace:');
            if (!usesWorkspaceRange && bumpVersionsWithWorkspaceProtocolOnly === true) {
              continue;
            }

            if (usesWorkspaceRange) {
              const workspaceDepVersion = depCurrentVersion.replace(/^workspace:/, '');
              // This kind of package is always up to date and updated by the package management tool.
              if (workspaceDepVersion === '*' || workspaceDepVersion === '^' || workspaceDepVersion === '~') {
                // Here, add the change log updated by dependency to the corresponding changelog.
                VersionUtilities.updateChanges(release, dependency);
                continue;
              }
              depCurrentVersion = workspaceDepVersion;
            }
            if (
              // an empty string is the normalized version of x/X/*
              // we don't want to change these versions because they will match
              // any version and if someone makes the range that
              // they probably want it to stay like that...
              new semver.Range(depCurrentVersion).range !== '' ||
              // ...unless the current version of a dependency is a prerelease (which doesn't satisfy x/X/*)
              // leaving those as is would leave the package in a non-installable state (wrong dep versions would get installed)
              semver.prerelease(newVersion) !== null
            ) {
              // avoid bad case , like a->b a->c a,b->d
              // if a@^0.0.1 in d , if bump a@1.1.1 , b、c、d will bump version
              // but a should not update version in d
              if (consumingPackages.get(name)?.includes(packageName)) {
                hasChange = true;
                VersionUtilities.updateChanges(release, dependency);

                let newNewRange = `${VersionUtilities.getVersionRangeType(depCurrentVersion)}${newVersion}`;
                if (usesWorkspaceRange) newNewRange = `workspace:${newNewRange}`;
                deps[name] = newNewRange;
              }
            }
          }
        }
      }

      if (hasChange) {
        updatedRelease.push({ packageJson, packageName, dir: packageInfo?.dir ?? '' });
      }
    }
    return updatedRelease;
  }

  /**
   * Update the package.json file of the change package
   * @param versionPlan List to be updated
   * @returns All updated packages and their corresponding json files
   */
  public static updatePackages(versionPlan: UpdatedVersionPlan[]): Map<string, PackageJSON> {
    const updated: Map<string, PackageJSON> = new Map();
    for (const { packageJson, dir, packageName } of versionPlan) {
      const saveResult = JsonFile.save(packageJson, `${dir}/package.json`);
      if (!saveResult) {
        throw new Error(`Update version error of package:${packageName}`);
      }
      updated.set(packageName, packageJson);
    }
    return updated;
  }

  public static createTagname(packageName: string, version: string, separator: string = '@'): string {
    return packageName + `${separator}` + version;
  }

  /**
   * Unified package version with fixed version number
   * @param releases List to be released
   * @param packagesByName All package information indexed by package name
   * @param versionContext Version change context
   * @returns Is there an update(boolean)
   */
  public static unifiedFixedVersion(
    releases: Map<string, ReleasePlan>,
    packagesByName: Map<string, Package>,
    versionContext: VersionContext
  ): boolean {
    let updated = false;

    for (const rules of versionContext.fixed) {
      const fixedPackages: ReleasePlan[] = [...packagesByName.values()]
        .filter((release) => {
          if (micromatch.isMatch(release.packageJson.name, rules)) return true;

          return false;
        })
        .map((p) => {
          const { name, version } = p.packageJson;
          if (releases.has(name)) return releases.get(name);
          return {
            name,
            oldVersion: version,
            versionType: 'none',
            changeInfo: {
              changes: [],
              packageName: name
            }
          };
        });

      if (fixedPackages.length === 0) continue;

      const highestReleaseType = VersionUtilities.getHighestReleaseType(fixedPackages);
      const highestVersion = VersionUtilities.getCurrentHighestVersion(fixedPackages);

      // Finally, we update the packages so all of them are on the highest version
      for (const { name } of fixedPackages) {
        const release = releases.get(name);

        if (!release) {
          updated = true;
          releases.set(name, {
            name,
            versionType: highestReleaseType,
            oldVersion: highestVersion,
            changeInfo: {
              changes: [],
              packageName: name
            },
            // Upgrade caused by version unification
            changeType: ChangeType.dependency
          });
          continue;
        }

        if (release.versionType !== highestReleaseType) {
          updated = true;
          release.versionType = highestReleaseType;
        }
        if (release.oldVersion !== highestVersion) {
          updated = true;
          release.oldVersion = highestVersion;
        }
      }
    }

    return updated;
  }

  /**
   * Get fixed grouping information
   * @param packagesByName All package information indexed by package name
   * @param versionContext Version change context
   * @returns Converted to fixed grouping of package name
   */
  public static getFixedPackageGroup(
    packagesByName: Map<string, Package>,
    versionContext: VersionContext
  ): Array<string[]> {
    const fixedGroup: Array<string[]> = [];
    for (const rules of versionContext.fixed) {
      const fixedPackages: string[] = [...packagesByName.values()]
        .filter((release) => {
          if (micromatch.isMatch(release.packageJson.name, rules)) return true;

          return false;
        })
        .map((p) => {
          const { name } = p.packageJson;
          return name;
        });
      fixedGroup.push(fixedPackages);
    }
    return fixedGroup;
  }
}
