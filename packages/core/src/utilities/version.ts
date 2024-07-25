import semver from 'semver';
import { Package } from '@manypkg/tools';
import { DependencyType, VersionType, PackageGroup, ChangeType, ReleasePlan } from '../types';

import { typeOrder } from './constant';
import { InternalError } from '../utilities';

export class VersionUtilities {
  public static getVersionRangeType(versionRange: string): '^' | '~' | '>=' | '<=' | '>' | '' {
    if (versionRange.charAt(0) === '^') return '^';
    if (versionRange.charAt(0) === '~') return '~';
    if (versionRange.startsWith('>=')) return '>=';
    if (versionRange.startsWith('<=')) return '<=';
    if (versionRange.charAt(0) === '>') return '>';
    return '';
  }

  public static getBumpLevel(type: VersionType) {
    const level = typeOrder[type];
    if (level === undefined) {
      throw new Error(`Unrecognised bump type ${type}`);
    }
    return level;
  }

  public static shouldUpdateDependencyBasedOnConfig({
    version,
    type,
    depVersionRange,
    depType,
    onlyUpdatePeerDependentsWhenOutOfRange
  }: {
    version: string;
    type: VersionType;
    depVersionRange: string;
    depType: DependencyType;
    onlyUpdatePeerDependentsWhenOutOfRange: boolean;
  }): boolean {
    if (!semver.satisfies(version, depVersionRange)) {
      // Dependencies leaving semver range should always be updated
      return true;
    }
    // There is a configuration in changesets to determine the minimum version of this update operation
    // such as patch or minor. Currently, there is no scenario seen, so it has been temporarily removed
    let shouldUpdate = this.getBumpLevel(type) >= typeOrder.patch;

    if (depType === 'peerDependencies') {
      shouldUpdate = !onlyUpdatePeerDependentsWhenOutOfRange;
    }
    return shouldUpdate;
  }

  public static updateChanges = (release: ReleasePlan, dependency: ReleasePlan) => {
    const { oldVersion, newVersion, name } = dependency;
    // skip no change version, like version by other changes
    if (newVersion === oldVersion) return;
    (release.changeInfo?.changes || []).push({
      packageName: release.name,
      changeType: ChangeType.dependency,
      comment:
        `Updating dependency "${name}" ` +
        (oldVersion ? `from \`${oldVersion}\` ` : '') +
        `to \`${newVersion}\``
    });
  };

  public static getPreVersion(version: string) {
    const parsed = semver.parse(version)!;
    let preVersion = parsed.prerelease[1] === undefined ? -1 : parsed.prerelease[1];
    if (typeof preVersion !== 'number') {
      throw new InternalError('You should use this ability when all preview versions are numbers.');
    }
    preVersion++;
    return preVersion;
  }

  /**
   * Get the highest version of the preview version,
   * which is suitable for locking the same version with the group package.
   * @param packageGroup A unified version of the package name is required.
   * @param packagesByName All package information aggregated by package name
   * @returns
   */
  public static getHighestPreVersion(
    packageGroup: PackageGroup,
    packagesByName: Map<string, Package>
  ): number {
    let highestPreVersion = 0;
    for (const pkg of packageGroup) {
      highestPreVersion = Math.max(
        this.getPreVersion(packagesByName.get(pkg)!.packageJson.version),
        highestPreVersion
      );
    }
    return highestPreVersion;
  }

  public static getHighestReleaseType(releases: ReleasePlan[]): VersionType {
    if (releases.length === 0) {
      throw new Error(`Internal error when calculating highest release type in the set of releases.`);
    }

    const highestReleaseType = releases.reduce<VersionType>((highestType, { versionType }) => {
      return typeOrder[versionType] > typeOrder[highestType] ? versionType : highestType;
    }, 'none');

    return highestReleaseType;
  }

  public static getCurrentHighestVersion(packageGroup: ReleasePlan[]): string {
    let highestVersion: string | undefined;

    for (const { oldVersion } of packageGroup) {
      if (highestVersion === undefined || semver.gt(oldVersion, highestVersion)) {
        highestVersion = oldVersion;
      }
    }

    return highestVersion!;
  }
}
