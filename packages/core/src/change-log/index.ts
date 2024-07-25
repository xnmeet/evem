// Reused the implementation of node-core-library.

import * as path from 'path';
import { FileSystem, JsonFile, JsonSchema } from '@rushstack/node-core-library';
import { Package } from '@manypkg/tools';
import { debug } from 'evem-logger';

import { ReleaseScheduler } from '../utilities';
import {
  ChangeType,
  ReleasePlan,
  IChangelog,
  IChangeLogEntry,
  IChangeLogComment,
  IChangeLogEntryComments
} from '../types';

import schemaJson from '../schemas/changelog.schema.json';

const CHANGELOG_JSON: string = 'CHANGELOG.json';
const CHANGELOG_MD: string = 'CHANGELOG.md';
const EOL: string = '\n';

export class ChangelogGenerator {
  /**
   * The JSON Schema for Changelog file (changelog.schema.json).
   */
  public static readonly jsonSchema: JsonSchema = JsonSchema.fromLoadedObject(schemaJson);

  /**
   * Updates the appropriate changelogs with the given changes.
   */
  public static updateChangelogs(
    allChanges: Map<string, ReleasePlan>,
    allPackages: Map<string, Package>,
    shouldCommit: boolean
  ): IChangelog[] {
    const updatedChangeLogs: IChangelog[] = [];

    allChanges.forEach((change, packageName) => {
      const project = allPackages.get(packageName);

      if (project) {
        const changeLog: IChangelog | undefined = ChangelogGenerator.updateIndividualChangelog(
          change,
          project.dir,
          shouldCommit
        );

        if (changeLog) {
          updatedChangeLogs.push(changeLog);
        }
      }
    });
    return updatedChangeLogs;
  }

  /**
   * Fully regenerate the markdown files based on the current json files.
   */
  public static regenerateChangelogs(allPackages: Map<string, Package>): void {
    allPackages.forEach((project) => {
      const markdownPath: string = path.resolve(project.dir, CHANGELOG_MD);
      const markdownJSONPath: string = path.resolve(project.dir, CHANGELOG_JSON);

      if (FileSystem.exists(markdownPath)) {
        if (!FileSystem.exists(markdownJSONPath)) {
          throw new Error('A CHANGELOG.md without json: ' + markdownPath);
        }

        const changelog: IChangelog = ChangelogGenerator._getChangelog(project.packageJson.name, project.dir);

        FileSystem.writeFile(
          path.join(project.dir, CHANGELOG_MD),
          ChangelogGenerator._translateToMarkdown(changelog)
        );
      }
    });
  }

  /**
   * Updates an individual changelog for a single project.
   */
  public static updateIndividualChangelog(
    change: ReleasePlan,
    projectFolder: string,
    shouldCommit: boolean
  ): IChangelog | undefined {
    const changelog: IChangelog = ChangelogGenerator._getChangelog(change.name, projectFolder);

    if (!changelog.entries.some((entry) => entry.version === change.newVersion)) {
      const changelogEntry: IChangeLogEntry = {
        version: change.newVersion!,
        tag: ReleaseScheduler.createTagname(change.name, change.newVersion!),
        date: new Date().toUTCString(),
        comments: {}
      };

      change.changeInfo.changes!.forEach((individualChange) => {
        if (individualChange.comment) {
          // Initialize the comments array only as necessary.
          const changeTypeString: keyof IChangeLogEntryComments = ChangeType[
            individualChange.changeType!
          ] as keyof IChangeLogEntryComments;

          changelogEntry.comments[changeTypeString] = changelogEntry.comments[changeTypeString] || [];
          const comments: IChangeLogComment[] = changelogEntry.comments[changeTypeString]!;

          const changeLogComment: IChangeLogComment = {
            comment: individualChange.comment
          };
          if (individualChange.author) {
            changeLogComment.author = individualChange.author;
          }
          if (individualChange.commit) {
            changeLogComment.commit = individualChange.commit;
          }
          if (individualChange.customFields) {
            changeLogComment.customFields = individualChange.customFields;
          }
          comments.push(changeLogComment);
        }
      });

      // Add the changelog entry to the start of the list.
      changelog.entries.unshift(changelogEntry);

      const changelogFilename: string = path.join(projectFolder, CHANGELOG_JSON);

      debug(
        `* ${shouldCommit ? 'APPLYING' : 'DRYRUN'}: ` +
          `Changelog update for "${change.name}@${change.newVersion}".`
      );

      if (shouldCommit) {
        // Write markdown transform.
        JsonFile.save(changelog, changelogFilename);

        FileSystem.writeFile(
          path.join(projectFolder, CHANGELOG_MD),
          ChangelogGenerator._translateToMarkdown(changelog)
        );
      }
      return changelog;
    }
    // change log not updated.
    return undefined;
  }

  /**
   * Loads the changelog json from disk, or creates a new one if there isn't one.
   */
  private static _getChangelog(packageName: string, projectFolder: string): IChangelog {
    const changelogFilename: string = path.join(projectFolder, CHANGELOG_JSON);
    let changelog: IChangelog | undefined;

    // Try to read the existing changelog.
    if (FileSystem.exists(changelogFilename)) {
      changelog = JsonFile.loadAndValidate(changelogFilename, ChangelogGenerator.jsonSchema);
    }

    if (!changelog) {
      changelog = {
        name: packageName,
        entries: []
      };
    } else {
      // Force the changelog name to be same as package name.
      // In case the package has been renamed but change log name is not updated.
      changelog.name = packageName;
    }

    return changelog;
  }

  /**
   * Translates the given changelog json object into a markdown string.
   */
  private static _translateToMarkdown(changelog: IChangelog): string {
    let markdown: string = [
      `# ${changelog.name}`,
      '',
      `This log was last generated on ${new Date().toUTCString()} and should not be manually modified.`,
      '',
      ''
    ].join(EOL);

    changelog.entries.forEach((entry, index) => {
      markdown += `## ${entry.version}${EOL}`;

      if (entry.date) {
        markdown += `${entry.date}${EOL}`;
      }

      markdown += EOL;

      let comments: string = '';

      comments += ChangelogGenerator._getChangeComments('Breaking changes', entry.comments.major);
      comments += ChangelogGenerator._getChangeComments('Minor changes', entry.comments.minor);
      comments += ChangelogGenerator._getChangeComments('Patches', entry.comments.patch);
      // 合并 dependency 和 none
      const updatesComment = [...(entry.comments.none || []), ...(entry.comments.dependency || [])];
      comments += ChangelogGenerator._getChangeComments(
        'Updates',
        updatesComment.length ? updatesComment : undefined
      );

      if (!comments) {
        markdown +=
          (changelog.entries.length === index + 1 ? 'Initial release' : 'Version update only') + EOL + EOL;
      } else {
        markdown += comments;
      }
    });

    return markdown;
  }

  /**
   * Helper to return the comments string to be appends to the markdown content.
   */
  private static _getChangeComments(title: string, commentsArray: IChangeLogComment[] | undefined): string {
    let comments: string = '';

    if (commentsArray) {
      comments = `### ${title}${EOL + EOL}`;
      commentsArray.forEach((comment) => {
        comments += `- ${comment.comment}${EOL}`;
      });
      comments += EOL;
    }

    return comments;
  }
}
