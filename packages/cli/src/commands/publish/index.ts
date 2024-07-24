import {
  CommandLineAction,
  CommandLineFlagParameter,
  CommandLineStringParameter,
  CommandLineStringListParameter
} from '@rushstack/ts-command-line';

import { error, success } from '@evem/logger';
import {
  ExitError,
  EvemConfiguration,
  publishRun,
  sortPackagesByDependencyOrder,
  VersionContext
} from '@evem/core';
import { packagesAdapter } from '../../utils/packages-adapter';
import { getAffectPackages } from '../../utils/packages-affect';

export class PublishAction extends CommandLineAction {
  private _tagName: CommandLineStringParameter;
  private _verbose: CommandLineFlagParameter;
  private _targetPackages: CommandLineStringListParameter;
  private _noGitTag: CommandLineFlagParameter;
  configuration: EvemConfiguration;

  public constructor(configuration: EvemConfiguration) {
    super({
      actionName: 'publish',
      summary: 'Publish package with release version changes',
      documentation: 'Publish package with release version changes'
    });
    this.configuration = configuration;
  }

  protected async onExecute(): Promise<void> {
    if (this._verbose.value) {
      process.env.EVEM_VERBOSE = 'true';
    }

    const versionContext: VersionContext = {
      bumpVersionsWithWorkspaceProtocolOnly: this.configuration.config.bumpVersionsWithWorkspaceProtocolOnly,
      fixed: this.configuration.config.fixed ?? [],
      include: this.configuration.config.include ?? [],
      ignoreDevDependencies: this.configuration.config.ignoreDevDependencies ?? true
    };

    try {
      const packages = packagesAdapter(
        await this.configuration.tool.getPackages(this.configuration.rootDir),
        versionContext
      );

      let orderPackages = sortPackagesByDependencyOrder(packages.packages);

      if (this._targetPackages.values.length) {
        orderPackages = getAffectPackages(packages, this._targetPackages.values, versionContext);
      }

      if (!orderPackages.length) {
        success('No packages needs to be released 🎉');
        return;
      }

      await publishRun({
        cwd: this.configuration.rootDir,
        tag: this._tagName.value,
        rootTool: this.configuration.tool.type === 'root',
        packages: orderPackages,
        config: this.configuration.config,
        gitTag: !this._noGitTag.value
      });
      success('Publish successfully 🎉');
    } catch (err) {
      if (err instanceof ExitError) {
        return process.exit(err.code);
      }
      error(err);
      process.exit(1);
    }
  }

  protected onDefineParameters(): void {
    this._tagName = this.defineStringParameter({
      argumentName: 'TAG_NAME',
      parameterLongName: '--tag',
      description: 'Publish tag, like:beta/alpha.It will be use when npm publish and git tag'
    });

    this._targetPackages = this.defineStringListParameter({
      argumentName: 'TO',
      parameterLongName: '--to',
      parameterShortName: '-t',
      description: 'Specify the package name that needs to publish.'
    });

    this._noGitTag = this.defineFlagParameter({
      parameterLongName: '--no-git-tag',
      parameterShortName: '-n',
      description: 'If specified, Will not tag the current commits'
    });

    this._verbose = this.defineFlagParameter({
      parameterLongName: '--verbose',
      parameterShortName: '-v',
      description: 'If specified, log information useful for debugging'
    });
  }
}
