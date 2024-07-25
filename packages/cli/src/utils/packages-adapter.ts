import { Packages, JsonFile, PackageJSON, VersionContext } from 'evem-core';
import micromatch from 'micromatch';
import path from 'path';

type RushJson = PackageJSON & {
  projects: {
    packageName: string;
    projectFolder: string;
    tags?: string[];
    shouldPublish?: boolean;
  }[];
};

export function packagesAdapter(packages: Packages, versionContext: VersionContext): Packages {
  if (packages.tool.type === 'rush') {
    const rushJson = JsonFile.load(path.resolve(packages.rootDir, 'rush.json')) as RushJson;
    packages.packages = packages.packages.filter((p) => {
      return !!rushJson.projects.find((r) => r.shouldPublish && r.packageName === p.packageJson.name);
    });
  }

  if (versionContext.include?.length) {
    packages.packages = packages.packages.filter((p) => {
      return micromatch.isMatch(p.relativeDir, versionContext.include);
    });
  }

  return packages;
}
