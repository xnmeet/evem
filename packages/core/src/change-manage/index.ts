// Reused the implementation of node-core-library.

import { Package, Packages } from '@manypkg/tools';
import {
  UpdatedVersionPlan,
  PackageJSON,
  ReleasePlan,
  IChangelog,
  ChangeType,
  VersionContext
} from '../types';
import { ReleaseScheduler, getDependentsGraph } from '../utilities';
import { ChangelogGenerator } from '../change-log';
import { ChangeFilesManage } from '../change-file';

/**
 * The class manages change files and controls how changes logged by change files
 * can be applied to package.json and change logs.
 */
export class ChangeManager {
  private _orderedChanges: ReleasePlan[];
  private _allPackages: Map<string, Package>;
  private _allChanges: Map<string, ReleasePlan>;
  private _changeFiles: ChangeFilesManage;
  private _packages: Packages;
  private _versionUpdatePlan: UpdatedVersionPlan[];
  private _targetPackages?: string[];
  private _versionContext: VersionContext;
  private _consumingPackages: Map<string, string[]>;

  public constructor(packages: Packages, versionContext: VersionContext, targetPackages?: string[]) {
    this._packages = packages;
    const allPackages = new Map(packages.packages.map((x) => [x.packageJson.name, x]));
    this._allPackages = allPackages;
    this._targetPackages = targetPackages;
    this._versionContext = versionContext;
  }

  /**
   * Load changes from change files
   * @param changesPath - location of change files
   * @param prereleaseToken - prerelease token
   * @param includeCommitDetails - whether commit details need to be included in changes
   */
  public load(changesPath: string): void {
    this._changeFiles = new ChangeFilesManage(changesPath);
    this._consumingPackages = getDependentsGraph(this._packages, this._versionContext);

    this._allChanges = ReleaseScheduler.findChangeRequests(
      this._packages,
      this._changeFiles,
      this._versionContext,
      this._consumingPackages,
      this._targetPackages
    );
    this._orderedChanges = ReleaseScheduler.sortChangeRequests(this._allChanges);
    // We will make certain changes to _orderedChanges internally, adding dependency update logs to the dependent party.
    this._versionUpdatePlan = ReleaseScheduler.updateDependentVersion(
      this._orderedChanges,
      this._allPackages,
      this._consumingPackages,
      this._versionContext
    );
  }

  public hasChanges(): boolean {
    return this._orderedChanges && this._orderedChanges.length > 0;
  }

  public get packageChanges(): ReleasePlan[] {
    return this._orderedChanges;
  }

  public get allChanges(): Map<string, ReleasePlan> {
    return this._allChanges;
  }

  public get allPackages(): Map<string, Package> {
    return this._allPackages;
  }

  public get versionUpdatePlan(): UpdatedVersionPlan[] {
    return this._versionUpdatePlan;
  }

  /**
   * Apply changes to package.json
   * @param shouldBeApply - If the value is true, package.json will be updated.
   * If the value is false, package.json and change logs will not be updated. It will only do a dry-run.
   */
  public apply(shouldBeApply: boolean): Map<string, PackageJSON> | undefined {
    if (!this.hasChanges() || !shouldBeApply) {
      return undefined;
    }

    // Apply all changes to package.json files.
    const updatedPackages: Map<string, PackageJSON> = ReleaseScheduler.updatePackages(
      this._versionUpdatePlan
    );
    return updatedPackages;
  }

  public updateChangelog(shouldBeApply: boolean): void {
    // Do not update changelog or delete the change files for prerelease.
    if (!this._versionContext.preName) {
      // Update changelogs.
      let updatedChangelogs: IChangelog[] = ChangelogGenerator.updateChangelogs(
        this._allChanges,
        this._allPackages,
        shouldBeApply
      );
      // Do not make changes to the file of type none.
      updatedChangelogs = updatedChangelogs.filter(
        (l) => this._allChanges.get(l.name)?.changeType !== ChangeType.dependency
      );

      this._changeFiles.deleteAll(shouldBeApply, updatedChangelogs);
    }
  }
}
