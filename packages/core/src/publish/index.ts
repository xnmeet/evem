import { PublishedResult, publishPackages, publishPackagesSync } from './publish-packages';
import { error, log, success, warn } from '@evem/logger';
import { Package } from '@manypkg/get-packages';
import { AccessType, Config } from '../types';
import { ExitError, git } from '../utilities';

function logReleases(pkgs: Array<{ name: string; newVersion: string }>) {
  const mappedPkgs = pkgs.map((p) => `${p.name}@${p.newVersion}`).join('\n');
  log(mappedPkgs);
}

function showNonLatestTagWarning(tag?: string) {
  warn(`Packages will be released under the ${tag} tag \n`);
}

type PublishProps = {
  cwd: string;
  tag?: string;
  gitTag?: boolean;
  config: Config;
  rootTool: boolean;
  packages: Package[];
};
/**
 * Independently enforceable release logic
 */
export async function publishRun({ tag, gitTag, cwd, config, rootTool, packages }: PublishProps) {
  const releaseTag = tag && tag.length > 0 ? tag : undefined;

  if (releaseTag) {
    showNonLatestTagWarning(tag);
  }

  const publishParams = {
    packages,
    // if not public, we won't pass the access, and it works as normal
    access: config.access as AccessType,
    tag: releaseTag,
    rootDir: cwd
  };
  // support sequence or concurrency
  const publishedPackages = config.publishSync
    ? await publishPackagesSync(publishParams)
    : await publishPackages(publishParams);

  if (publishedPackages.length === 0) {
    warn('No unpublished projects to publish');
  }

  const successfulNpmPublishes = publishedPackages.filter((p) => p.published);
  const unsuccessfulNpmPublishes = publishedPackages.filter((p) => !p.published);

  if (successfulNpmPublishes.length > 0) {
    success('packages published successfully:');
    logReleases(successfulNpmPublishes);

    if (gitTag) {
      log(`Creating git tag${successfulNpmPublishes.length > 1 ? 's' : ''}...`);
      await tagPublish(rootTool, successfulNpmPublishes, cwd, config.tagSeparator);
    }
  }

  if (unsuccessfulNpmPublishes.length > 0) {
    error('packages failed to publish:');
    logReleases(unsuccessfulNpmPublishes);
    throw new ExitError(1);
  }
}

async function tagPublish(
  rootTool: boolean,
  packageReleases: PublishedResult[],
  cwd: string,
  tagSeparator = '@'
) {
  if (!rootTool) {
    for (const pkg of packageReleases) {
      const tag = `${pkg.name}${tagSeparator}${pkg.newVersion}`;
      log('New tag: ', tag);
      await git.tag(tag, cwd);
    }
  } else {
    const tag = `v${packageReleases[0].newVersion}`;
    log('New tag: ', tag);
    await git.tag(tag, cwd);
  }
}
