import {
  CommandLineAction,
  CommandLineFlagParameter,
  CommandLineStringListParameter
} from '@rushstack/ts-command-line';

import { debug, error, success, warn } from '@evem/logger';
import { git, EvemConfiguration, ChangeFileGenerate, ExitError, VersionContext } from '@evem/core';
import chalk from 'chalk';
import { packagesAdapter } from '../../utils/packages-adapter';
import { askSelectVersionAndDesc } from './assistant';

export class ChangeAction extends CommandLineAction {
  private _verbose: CommandLineFlagParameter;
  private _targetPackages: CommandLineStringListParameter;
  configuration: EvemConfiguration;

  public constructor(configuration: EvemConfiguration) {
    super({
      actionName: 'change',
      summary: 'Generate changes summary',
      documentation: 'Generate changes summary'
    });
    this.configuration = configuration;
  }

  protected async onExecute(): Promise<void> {
    if (this._verbose.value) {
      process.env.EVEM_VERBOSE = 'true';
    }

    const versionContext: VersionContext = {
      include: this.configuration.config.include ?? []
    };
    try {
      const packages = packagesAdapter(
        await this.configuration.tool.getPackages(this.configuration.rootDir),
        versionContext
      );
      const packageLookup = new Set<string>();

      if (this._targetPackages.values.length) {
        for (const name of this._targetPackages.values) {
          const packageItem = packages.packages.find((item) => item.packageJson.name === name);
          if (packageItem) packageLookup.add(packageItem.packageJson.name);
          else {
            warn(`The package of ${name} is not exist,or already excluded in the include statement.`);
          }
        }
      } else {
        const baseBranch = this.configuration.config.baseBranch;
        debug(`Detect whether the base branch '${baseBranch}' exists`);
        const isBaseBranchExist = git.isBranchExist(baseBranch, this.configuration.rootDir);

        if (isBaseBranchExist) {
          const changedFiles = git.getChangedFiles(baseBranch, this.configuration.rootDir);

          for (const file of changedFiles) {
            const packageItem = packages.packages.find((item) => file.startsWith(item.relativeDir));
            if (packageItem) packageLookup.add(packageItem.packageJson.name);
          }
        } else {
          warn(`The base branch '${baseBranch}' not exists, will use all packages in workspace`);
          packages.packages.forEach((item) => packageLookup.add(item.packageJson.name));
        }
      }

      if (!packageLookup.size) {
        success(
          `No package to change (you may need to commit first,then run ${chalk.yellow('evem change')}) 🎉`
        );
        return;
      }

      const changeFilesOfPackage = await askSelectVersionAndDesc([...packageLookup]);
      if (!changeFilesOfPackage.length) {
        return;
      }

      for (const file of changeFilesOfPackage) {
        debug(`* Generate changes for ${file.packageName}`);
        new ChangeFileGenerate(file, {
          changesFolder: this.configuration.changesFolder,
          cwd: this.configuration.rootDir
        }).writeSync();
      }

      success('Generate changes success 🎉');
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
      description: 'Specify the package name that needs to generate the change log.'
    });

    this._verbose = this.defineFlagParameter({
      parameterLongName: '--verbose',
      parameterShortName: '-v',
      description: 'If specified, log information useful for debugging'
    });
  }
}
