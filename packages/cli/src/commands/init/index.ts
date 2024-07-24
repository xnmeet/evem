import { CommandLineAction, CommandLineFlagParameter } from '@rushstack/ts-command-line';
import { error, success } from '@evem/logger';
import { ExitError, EvemConfiguration, JsonFile } from '@evem/core';
import fs from 'fs';
import { initConfigAdapter } from '../../utils/config-adpater';

export class InitAction extends CommandLineAction {
  private _verbose: CommandLineFlagParameter;
  configuration: EvemConfiguration;

  public constructor(configuration: EvemConfiguration) {
    super({
      actionName: 'init',
      summary: 'Init evem basic config',
      documentation: 'Init evem basic config'
    });
    this.configuration = configuration;
  }

  protected async onExecute(): Promise<void> {
    if (this._verbose.value) {
      process.env.EVEM_VERBOSE = 'true';
    }

    try {
      if (fs.existsSync(this.configuration.configPath)) {
        success('Evem configuration already exists 🎉');
        return;
      }
      const config = await initConfigAdapter(this.configuration);
      JsonFile.save(config, this.configuration.configPath, { ensureFolderExists: true });

      success('Evem init successfully 🎉');
    } catch (err) {
      if (err instanceof ExitError) {
        return process.exit(err.code);
      }
      error(err);
      process.exit(1);
    }
  }

  protected onDefineParameters(): void {
    this._verbose = this.defineFlagParameter({
      parameterLongName: '--verbose',
      parameterShortName: '-v',
      description: 'If specified, log information useful for debugging'
    });
  }
}
