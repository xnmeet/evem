import { Package, Packages, VersionContext, getDependentsGraph } from '@evem/core';

export function getAffectPackages(
  packages: Packages,
  target: readonly string[],
  versionContext: VersionContext
): Package[] {
  const affectPackages = new Set(target);
  const consumingPackages = getDependentsGraph(packages, versionContext, true);

  for (const pkg of target) {
    const consumePkgs = consumingPackages.get(pkg) || [];
    consumePkgs.forEach((p) => {
      affectPackages.add(p);
    });
  }

  return packages.packages.filter((l) => affectPackages.has(l.packageJson.name));
}
