// Reused the implementation of node-core-library.

import { JsonFile, FileSystem } from '@rushstack/node-core-library';
import { debug } from 'evem-logger';
import glob from 'glob';

import { IChangelog, IChangeInfo } from '../types';

/**
 * This class represents the collection of change files existing in the repo and provides operations
 * for those change files.
 */
export class ChangeFilesManage {
  /**
   * Change file path relative to changes folder.
   */
  private _files: string[] | undefined;
  private _changesPath: string;

  public constructor(changesPath: string) {
    this._changesPath = changesPath;
  }

  /**
   * Get the array of absolute paths of change files.
   */
  public getFiles(): string[] {
    if (!this._files) {
      this._files = glob.sync(`${this._changesPath}/**/*.json`) || [];
    }

    return this._files;
  }

  /**
   * Get the path of changes folder.
   */
  public getChangesPath(): string {
    return this._changesPath;
  }

  /**
   * Delete all change files
   */
  public deleteAll(shouldDelete: boolean, updatedChangelogs?: IChangelog[]): number {
    if (updatedChangelogs) {
      // Skip changes files if the package's change log is not updated.
      const packagesToInclude: Set<string> = new Set<string>();
      updatedChangelogs.forEach((changelog) => {
        packagesToInclude.add(changelog.name);
      });

      const filesToDelete: string[] = this.getFiles().filter((filePath) => {
        const changeRequest: IChangeInfo = JsonFile.load(filePath);
        for (const changeInfo of changeRequest.changes!) {
          if (!packagesToInclude.has(changeInfo.packageName)) {
            return false;
          }
        }
        return true;
      });

      return this._deleteFiles(filesToDelete, shouldDelete);
    } else {
      // Delete all change files.
      return this._deleteFiles(this.getFiles(), shouldDelete);
    }
  }

  private _deleteFiles(files: string[], shouldDelete: boolean): number {
    if (files.length) {
      debug(`* ${shouldDelete ? 'DELETING:' : 'DRYRUN: Deleting'} ${files.length} change file(s).`);

      for (const filePath of files) {
        debug(` - ${filePath}`);

        if (shouldDelete) {
          FileSystem.deleteFile(filePath);
        }
      }
    }
    return files.length;
  }
}
