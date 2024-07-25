import type { Package, MonorepoRoot } from '@manypkg/tools';
import type { IChangeInfo, ChangeType } from './change-file';

export * from './change-file';
export * from './change-log';

export type PackageConfiguration = Package & {
  consumingPackages: string[];
};

export const DEPENDENCY_TYPES = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies'
] as const;

export type AccessType = 'public' | 'restricted';

export type PackageJSON = {
  name: string;
  version: string;
  dependencies?: { [key: string]: string };
  peerDependencies?: { [key: string]: string };
  devDependencies?: { [key: string]: string };
  optionalDependencies?: { [key: string]: string };
  resolutions?: { [key: string]: string };
  private?: boolean;
  publishConfig?: {
    access?: AccessType;
    directory?: string;
    registry?: string;
  };
};

export type PackageGroup = ReadonlyArray<string>;

export type VersionType = 'major' | 'minor' | 'patch' | 'none';

export type DependencyType = (typeof DEPENDENCY_TYPES)[number];

export type UpdatedVersionPlan = { packageName: string; dir: string; packageJson: PackageJSON };

export type DependencyVersionRange = {
  depType: DependencyType;
  versionRange: string;
};

export type ReleasePlan = {
  name: string;
  /** 内部计算后的变更类型 */
  changeType?: ChangeType;
  /** 用户手动指定的变更类型 */
  versionType: VersionType;
  oldVersion: string;
  newVersion?: string;
  changeInfo: IChangeInfo;
};

export type VersionContext = {
  /** 预览版本号 */
  preName?: string;
  /** 只对 workspace 声明的依赖做版本更新 */
  bumpVersionsWithWorkspaceProtocolOnly?: boolean;
  /** 只有当 peerDep 超出版本范围是更新 peerDep 的版本 */
  onlyUpdatePeerDependentsWhenOutOfRange?: boolean;
  /** 是否只针对 none 类型发布预览版 */
  onlyNone?: boolean;
  /** 需要统一版本号的分组 */
  fixed?: string[][];
  /** 需要包含的文件,会在 include 范围查找和发布包 */
  include?: string[];
  /** 只发布独立包，不发布下游依赖 */
  independent?: boolean;
  /** 当只有依赖的 devDependencies 更新时，忽略版本升级 */
  ignoreDevDependencies?: boolean;
};

export type Config = {
  $schema?: string;
  tagSeparator?: string;
  publishSync?: boolean;
  commit?: false | readonly [string, any];
  access?: AccessType;
  baseBranch: string;
  /** This is supposed to be used with pnpm's `link-workspace-packages: false` and Berry's `enableTransparentWorkspaces: false` */
  bumpVersionsWithWorkspaceProtocolOnly?: boolean;
  /** 只有当 peerDep 超出版本范围是更新 peerDep 的版本 */
  onlyUpdatePeerDependentsWhenOutOfRange?: boolean;
  /** 变更日志存放路径，支持自定义存放目录 */
  changesFolder?: string;
  /** 需要统一版本号的分组 */
  fixed?: string[][];
  /** 需要包含的文件,会在 include 范围查找和发布包 */
  include?: string[];
  /** 当只有依赖的 devDependencies 更新时，忽略版本升级 */
  ignoreDevDependencies?: boolean;
};

export type EvemConfiguration = MonorepoRoot & {
  config: Config;
  /** package 变更文件所在目录 */
  changesFolder: string;
  /** 执行根目录 */
  rootDir: string;
  /** 配置文件路径 */
  configPath: string;
};
