import {
  CommandLineAction,
  CommandLineFlagParameter,
  CommandLineStringListParameter,
  CommandLineStringParameter
} from '@rushstack/ts-command-line';

import { error, success, list } from '@evem/logger';
import { ChangeManager, ExitError, EvemConfiguration, VersionContext } from '@evem/core';
import { EventCoreEmit } from '@evem/event';
import { packagesAdapter } from '../../utils/packages-adapter';

export class VersionAction extends CommandLineAction {
  private _preName: CommandLineStringParameter;
  private _verbose: CommandLineFlagParameter;
  private _targetPackages: CommandLineStringListParameter;
  private _listOnly: CommandLineFlagParameter;
  private _onlyNone: CommandLineFlagParameter;
  private _independent: CommandLineFlagParameter;
  configuration: EvemConfiguration;

  public constructor(configuration: EvemConfiguration) {
    super({
      actionName: 'version',
      summary: 'Apply modified packages version',
      documentation: 'Apply modified packages version'
    });
    this.configuration = configuration;
  }

  protected async onExecute(): Promise<void> {
    if (this._verbose.value) {
      process.env.EVEM_VERBOSE = 'true';
    }
    if (this._listOnly.value) {
      // just log result
      process.env.EVEM_LIST = 'true';
      process.env.EVEM_SILENT = 'true';
    }

    const versionContext: VersionContext = {
      preName: this._preName.value,
      bumpVersionsWithWorkspaceProtocolOnly: this.configuration.config.bumpVersionsWithWorkspaceProtocolOnly,
      onlyNone: this._onlyNone.value,
      fixed: this.configuration.config.fixed ?? [],
      include: this.configuration.config.include ?? [],
      independent: this._independent.value,
      ignoreDevDependencies: this.configuration.config.ignoreDevDependencies ?? true
    };

    try {
      const packages = packagesAdapter(
        await this.configuration.tool.getPackages(this.configuration.rootDir),
        versionContext
      );

      const changeManage = new ChangeManager(
        packages,
        versionContext,
        this._targetPackages.values as string[]
      );

      changeManage.load(this.configuration.changesFolder);

      const readyVersion = changeManage.packageChanges.filter((p) => p.versionType !== 'none');
      // 仅输出结果而不应用文件变更
      if (this._listOnly.value) {
        const listResult = readyVersion.map((p) => {
          // changeInfo 输出没有可读性
          const { changeInfo, ...props } = p;
          return props;
        });

        EventCoreEmit.emitVersionPlan(readyVersion);
        list(JSON.stringify(listResult, null, 2));
        return;
      }

      if (!changeManage.packageChanges.length) {
        EventCoreEmit.emitVersionPlan(readyVersion);
        success('Version finish,no changes found 🎉');
        return;
      }
      // just gen changelog for stable version
      changeManage.apply(true);
      changeManage.updateChangelog(!this._preName.value);
      EventCoreEmit.emitVersionPlan(readyVersion);
      success('Version finish 🎉');
    } catch (err) {
      if (err instanceof ExitError) {
        return process.exit(err.code);
      }
      error(err);
      process.exit(1);
    }
  }

  protected onDefineParameters(): void {
    this._targetPackages = this.defineStringListParameter({
      argumentName: 'TO',
      parameterLongName: '--to',
      parameterShortName: '-t',
      description:
        'You can specify the package name that needs to generate the change log. Instead of applying all.'
    });

    this._preName = this.defineStringParameter({
      argumentName: 'PRE_NAME',
      parameterLongName: '--pre',
      description:
        'Prerelease version name,It can be a specific version number or version type,like:beta or beta.1'
    });

    this._onlyNone = this.defineFlagParameter({
      parameterLongName: '--only-none',
      description: `Release packages with change type of "none" only, this option needs to be used with "--pre".`
    });

    this._independent = this.defineFlagParameter({
      parameterLongName: '--independent',
      description: `Publish limited packages without downstream dependencies.`
    });

    this._listOnly = this.defineFlagParameter({
      parameterLongName: '--list',
      description: 'Display only the result of the version without actually applying the version.'
    });

    this._verbose = this.defineFlagParameter({
      parameterLongName: '--verbose',
      parameterShortName: '-v',
      description: 'If specified, log information useful for debugging.'
    });
  }
}
