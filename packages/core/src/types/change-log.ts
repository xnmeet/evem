// Reused the implementation of node-core-library.

/**
 * Interface representing a changelog json object for a package used to represent the parsed
 * content of CHANGELOG.json
 */
export interface IChangelog {
  /**
   * Name of the project
   */
  name: string;

  /**
   * Entries within the changelog corresponding to each published version.
   */
  entries: IChangeLogEntry[];
}

/**
 * Interface representing a single published entry in the changelog.
 */
export interface IChangeLogEntryComments {
  /** Describes changes which cause a patch-level SemVer bump */
  patch?: IChangeLogComment[];
  /** Describes changes which cause a minor-level SemVer bump */
  minor?: IChangeLogComment[];
  /** Describes changes which cause a major-level SemVer bump */
  major?: IChangeLogComment[];
  /** Describes changes to the package's dependencies */
  dependency?: IChangeLogComment[];
  /** Describe changes that do not have version information */
  none?: IChangeLogComment[];
}

/**
 * Interface representing a single published entry in the changelog.
 */
export interface IChangeLogEntry {
  /**
   * Published version for the entry. (Example: 1.0.0)
   */
  version: string;

  /**
   * Git tag used to identify the published commit. (Example: b7f55611e54910327a206476b185265498c66acf)
   */
  tag: string;

  /**
   * The UTC date when the publish was applied. (Example: Fri, 02 Dec 2016 22:27:16 GMT)
   */
  date: string | undefined;

  /**
   * Comments for the entry, where key represents the ChangeType string (Example: major)
   */
  comments: IChangeLogEntryComments;
}

/**
 * Interface representing a single changelog comment within an entry.
 */
export interface IChangeLogComment {
  /**
   * The given comment. (supports markdown.)
   */
  comment: string;

  /**
   * The author, if applicable, that created the change request.
   */
  author?: string;

  /**
   * The commit, if applicable, including the change request.
   */
  commit?: string;

  /**
   * An optional dictionary of custom string fields.
   */
  customFields?: Record<string, string>;
}
