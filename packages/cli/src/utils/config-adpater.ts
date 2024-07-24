import prompts from 'prompts';
import { Config, EvemConfiguration, JsonFile } from 'evem-core';
import { cancelFlow } from './command';

async function askRushConfig(): Promise<string> {
  const { value } = await prompts(
    {
      type: 'confirm',
      name: 'value',
      message: 'You seem to be using rush,Do you want to reuse the changes directory?',
      initial: true
    },
    {
      onCancel: cancelFlow
    }
  );
  if (value) return 'common/changes';
  return '';
}

async function askBaseBranch(): Promise<string> {
  const { branch } = await prompts(
    {
      type: 'text',
      name: 'branch',
      message: `Which branch you want to use as the base branch? (default : main)`,
      initial: 'main',
      validate: (value) => {
        if (!value?.trim()) return 'branch can not be empty';
        return true;
      }
    },
    {
      onCancel: cancelFlow
    }
  );
  return branch;
}

export async function initConfigAdapter(configuration: EvemConfiguration): Promise<Config> {
  const coreJson = JsonFile.load(require.resolve('evem-core/package.json'));
  const basicConfig: Config = {
    $schema: `https://unpkg.byted-static.com/evem/core/${coreJson.version}/src/schemas/config.schema.json`,
    baseBranch: 'main',
    access: 'public'
  };

  let changesFolder: string;
  switch (configuration.tool.type) {
    case 'rush':
      changesFolder = await askRushConfig();
      break;
    default:
      break;
  }

  if (changesFolder) {
    basicConfig.changesFolder = changesFolder;
  }

  const baseBranch = await askBaseBranch();
  basicConfig.baseBranch = baseBranch;
  return basicConfig;
}
