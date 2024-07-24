import { error, debug } from '@evem/logger';
import pLimit from 'p-limit';
import preferredPM from 'preferred-pm';
import spawn from 'spawndamnit';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import lodash from 'lodash';

import { PackageJSON, AccessType } from '../types';
import { ExitError, executeCommand, JsonFile } from '../utilities';

export type PublishTool = {
  name: 'npm' | 'pnpm';
  shouldAddNoGitChecks?: boolean;
};

interface PublishOptions {
  publishTool: PublishTool;
  cwd: string;
  publishDir: string;
  access: AccessType;
  tag: string;
}

const npmRequestLimit = pLimit(40);
const npmPublishLimit = pLimit(10);

const getLastJsonObjectFromString = (str: string) => {
  str = str.replace(/[^}]*$/, '');

  while (str) {
    str = str.replace(/[^{]*/, '');

    try {
      return JSON.parse(str);
    } catch (err) {
      // move past the potentially leading `{` so the regexp in the loop can try to match for the next `{`
      str = str.slice(1);
    }
  }
  return null;
};

function jsonParse(input: string) {
  try {
    return JSON.parse(input);
  } catch (err) {
    if (err instanceof SyntaxError) {
      console.error('error parsing json:', input);
    }
    throw err;
  }
}

const getNpmConfigRegistry = lodash.memoize(() => {
  let registry = '';
  try {
    registry = executeCommand('npm', ['config', 'get', 'registry']);
  } catch (e) {
    // if error will skip
    registry = '';
  }
  return registry;
});

function getCorrectRegistry(packageJson?: PackageJSON): string {
  let registry = packageJson?.publishConfig?.registry ?? process.env.npm_config_registry;
  if (!registry) registry = getNpmConfigRegistry();

  return !registry || registry === 'https://registry.yarnpkg.com' ? 'https://registry.npmjs.org' : registry;
}

export async function getPublishTool(cwd: string): Promise<PublishTool> {
  let pm = await preferredPM(cwd);
  // adapter rush
  if (fs.existsSync(path.resolve(cwd, 'rush.json'))) {
    const rushJson = JsonFile.load(path.resolve(cwd, 'rush.json'));
    if (rushJson.pnpmVersion)
      pm = {
        name: 'pnpm',
        version: rushJson.pnpmVersion
      };
  }

  if (!pm || pm.name !== 'pnpm') return { name: 'npm' };
  // Not compatible with pnpm<5 version
  return {
    name: 'pnpm',
    shouldAddNoGitChecks: true
  };
}

export function getPackageInfo(packageJson: PackageJSON) {
  return npmRequestLimit(async () => {
    debug(`npm info ${packageJson.name}`);

    // Due to a couple of issues with yarnpkg, we also want to override the npm registry when doing
    // npm info.
    // Issues: We sometimes get back cached responses, i.e old data about packages which causes
    // `publish` to behave incorrectly. It can also cause issues when publishing private packages
    // as they will always give a 404, which will tell `publish` to always try to publish.
    // See: https://github.com/yarnpkg/yarn/issues/2935#issuecomment-355292633
    const result = await spawn('npm', [
      'info',
      packageJson.name,
      '--registry',
      getCorrectRegistry(packageJson),
      '--json'
    ]);

    // Github package registry returns empty string when calling npm info
    // for a non-existent package instead of a E404
    if (result.stdout.toString() === '') {
      return {
        error: {
          code: 'E404'
        }
      };
    }
    return jsonParse(result.stdout.toString());
  });
}

export async function infoAllow404(packageJson: PackageJSON) {
  const pkgInfo = await getPackageInfo(packageJson);
  if (pkgInfo.error?.code === 'E404') {
    return { published: false, pkgInfo: {} };
  }
  if (pkgInfo.error) {
    error(
      `Received an unknown error code: ${pkgInfo.error.code} for npm info ${chalk.cyan(
        `"${packageJson.name}"`
      )}`
    );
    error(pkgInfo.error.summary);
    if (pkgInfo.error.detail) error(pkgInfo.error.detail);

    throw new ExitError(1);
  }
  return { published: true, pkgInfo };
}

// we have this so that we can do try a publish again after a publish without
// the call being wrapped in the npm request limit and causing the publishes to potentially never run
async function internalPublish(pkgName: string, opts: PublishOptions): Promise<{ published: boolean }> {
  const { publishTool, access, publishDir, cwd, tag } = opts;
  const { name, shouldAddNoGitChecks } = publishTool;

  const publishFlags = access ? ['--access', access] : [];
  publishFlags.push('--tag', tag);

  if (name === 'pnpm' && shouldAddNoGitChecks) {
    publishFlags.push('--no-git-checks');
  }

  // Due to a super annoying issue in yarn, we have to manually override this env variable
  // See: https://github.com/yarnpkg/yarn/issues/2935#issuecomment-355292633
  const envOverride = {
    npm_config_registry: getCorrectRegistry()
  };
  const { code, stdout, stderr } =
    name === 'pnpm'
      ? await spawn('pnpm', ['publish', '--json', ...publishFlags], {
          env: Object.assign({}, process.env, envOverride),
          cwd
        })
      : await spawn(name, ['publish', publishDir, '--json', ...publishFlags], {
          env: Object.assign({}, process.env, envOverride)
        });

  if (code !== 0) {
    // NPM's --json output is included alongside the `prepublish` and `postpublish` output in terminal
    // We want to handle this as best we can but it has some struggles:
    // - output of those lifecycle scripts can contain JSON
    // - npm7 has switched to printing `--json` errors to stderr (https://github.com/npm/cli/commit/1dbf0f9bb26ba70f4c6d0a807701d7652c31d7d4)
    // Note that the `--json` output is always printed at the end so this should work
    const json =
      getLastJsonObjectFromString(stderr.toString()) || getLastJsonObjectFromString(stdout.toString());

    if (json?.error) {
      error(
        `an error occurred while publishing ${pkgName}: ${json.error.code}`,
        json.error.summary,
        json.error.detail ? '\n' + json.error.detail : ''
      );
    } else {
      error(stderr.toString() || stdout.toString());
    }

    return { published: false };
  }
  return { published: true };
}

export function publish(pkgName: string, opts: PublishOptions): Promise<{ published: boolean }> {
  // If there are many packages to be published, it's better to limit the
  // concurrency to avoid unwanted errors, for example from npm.
  return npmRequestLimit(() => npmPublishLimit(() => internalPublish(pkgName, opts)));
}
