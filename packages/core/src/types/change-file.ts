// Reused the implementation of node-core-library.

/**
 * Representation for a changes file
 */
export interface IChangeFile {
  changes: IChangeInfo[];
  packageName: string;
  email?: string;
}

export type VersionType = 'major' | 'minor' | 'patch' | 'none';

/**
 * Represents all of the types of change requests.
 */
export enum ChangeType {
  none = 0,
  dependency = 1,
  patch = 2,
  minor = 3,
  major = 4
}

// Although all changes are of this type, only the top level contains content related to changes, and only the top level has rich field filling. The explanation is given to avoid confusion about types.
// Basic contents under 'changes' include changeType, comment and packageName.
export interface IChangeInfo {
  /**
   * Defines the type of change. This is not expected to exist within the JSON file definition as we
   * parse it from the "type" property.
   */
  changeType?: ChangeType;
  /**
   * Defines the array of related changes for the given package. This is used to iterate over comments
   * requested by the change requests.
   */
  changes?: IChangeInfo[];
  /**
   * A user provided comment for the change.
   */
  comment?: string;

  /**
   * An optional dictionary of custom string fields.
   */
  customFields?: Record<string, string>;

  /**
   * The email of the user who provided the comment. Pulled from the Git log.
   */
  author?: string;

  /**
   * The commit hash for the change.
   */
  commit?: string;

  /**
   * The new downstream range dependency, as calculated by the findChangeRequests function.
   */
  newRangeDependency?: string;

  /**
   * The new version for the package, as calculated by the findChangeRequests function.
   */
  newVersion?: string;

  /**
   * The order in which the change request should be published.
   */
  order?: number;

  /**
   * The name of the package.
   */
  packageName: string;

  /**
   * The type of the package publishing request (patch/minor/major), as provided by the JSON file.
   */
  type?: VersionType;
}
