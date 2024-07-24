import { JsonFile, JsonSchema } from '@rushstack/node-core-library';
import path from 'path';
import chalk from 'chalk';
import { findRootSync } from '@manypkg/find-root';
import { debug } from '@evem/logger';

import { Config, EvemConfiguration } from '../types';
import configSchema from '../schemas/config.schema.json';

export function loadConfig(configPath: string): Config {
  debug(`Load evem config in ${configPath}`);
  try {
    const schema: JsonSchema = JsonSchema.fromLoadedObject(configSchema);
    return JsonFile.loadAndValidate(configPath, schema) as Config;
  } catch (e: any) {
    throw new Error(
      `Load evem config file error, Please run ${chalk.yellow(
        'evem init'
      )} to initialize the configuration.\n${e}`
    );
  }
}

export function getProjectConfiguration(cwd?: string): EvemConfiguration {
  const monorepoRoot = findRootSync(cwd || process.cwd());

  const changesFolder = path.resolve(monorepoRoot.rootDir, '.evem/changes');
  const configPath = path.resolve(monorepoRoot.rootDir, '.evem/config.json');

  return {
    ...monorepoRoot,
    changesFolder,
    configPath
  } as EvemConfiguration;
}
