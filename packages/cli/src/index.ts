import { CommandLineFlagParameter, CommandLineParser } from '@rushstack/ts-command-line';
import path from 'path';
import chalk from 'chalk';
import { error, info } from 'evem-logger';
import { getProjectConfiguration, EvemConfiguration, ExitError, loadConfig } from 'evem-core';
import { ChangeAction, VersionAction, PublishAction, InitAction } from './commands';
import { resetEnv } from './utils/env';

export class Evem extends CommandLineParser {
  private _silent: CommandLineFlagParameter;
  configuration: EvemConfiguration;

  public constructor() {
    super({
      toolFilename: 'evem',
      toolDescription: 'Make the version release more efficient.'
    });

    resetEnv();

    try {
      this.configuration = getProjectConfiguration();
    } catch (err) {
      if (err instanceof ExitError) {
        return process.exit(err.code);
      }
      error(err);
      process.exit(1);
    }

    this.addAction(new ChangeAction(this.configuration));
    this.addAction(new VersionAction(this.configuration));
    this.addAction(new PublishAction(this.configuration));
    this.addAction(new InitAction(this.configuration));
  }

  protected onExecute(): Promise<void> {
    if (this._silent.value) {
      process.env.EVEM_SILENT = 'true';
    }

    if (this.selectedAction.actionName !== 'init') {
      const config = loadConfig(this.configuration.configPath);
      this.configuration.config = config;
      if (config.changesFolder)
        this.configuration.changesFolder = path.resolve(this.configuration.rootDir, config.changesFolder);
    } else {
      info(`Detected management tool ${chalk.magentaBright(this.configuration.tool.type)}`);
    }

    return super.onExecute();
  }

  protected onDefineParameters(): void {
    this._silent = this.defineFlagParameter({
      parameterLongName: '--silent',
      parameterShortName: '-s',
      description: 'Silent execution without outputting any logs'
    });
  }
}

export { EventCoreOn, EventType } from 'evem-event';
export { ReleasePlan as OnVersionPlanData } from 'evem-core';
