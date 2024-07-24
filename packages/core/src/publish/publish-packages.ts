import { join } from 'path';
import chalk from 'chalk';
import { Package } from '@manypkg/get-packages';
import { info, log, warn, dynamicLog } from 'evem-logger';
import lodash from 'lodash';
import * as npmUtils from '../utilities/npm';
import { AccessType } from '../types';

type PublishedState = 'never' | 'published';

type PkgInfo = {
  name: string;
  localVersion: string;
  publishedState: PublishedState;
  publishedVersions: string[];
};

export type PublishedResult = {
  name: string;
  newVersion: string;
  published: boolean;
};

type PublishPackagesOption = {
  packages: Package[];
  access: AccessType;
  rootDir: string;
  tag?: string;
};

function getReleaseTag(tag?: string) {
  if (tag) return tag;
  return 'latest';
}

export const getPublishTool = lodash.memoize(async (cwd: string) => {
  return await npmUtils.getPublishTool(cwd);
});

export async function publishPackages({ packages, access, tag, rootDir }: PublishPackagesOption) {
  const packagesByName = new Map(packages.map((x) => [x.packageJson.name, x]));
  const publicPackages = packages.filter((pkg) => !pkg.packageJson.private);
  const unpublishedPackagesInfo = await getUnpublishedPackages(publicPackages);

  if (unpublishedPackagesInfo.length === 0) {
    return [];
  }

  const publishTool = await getPublishTool(rootDir);
  return Promise.all(
    unpublishedPackagesInfo.map((pkgInfo) => {
      const pkg = packagesByName.get(pkgInfo.name)!;
      return publishAPackage(pkg, access, getReleaseTag(tag), publishTool);
    })
  );
}

export async function publishPackagesSync({ packages, access, tag, rootDir }: PublishPackagesOption) {
  const packagesByName = new Map(packages.map((x) => [x.packageJson.name, x]));
  const publicPackages = packages.filter((pkg) => !pkg.packageJson.private);
  const unpublishedPackagesInfo = await getUnpublishedPackages(publicPackages);

  if (unpublishedPackagesInfo.length === 0) {
    return [];
  }

  const publishTool = await getPublishTool(rootDir);
  const publishResult: PublishedResult[] = [];

  for (const pkgInfo of unpublishedPackagesInfo) {
    const pkg = packagesByName.get(pkgInfo.name)!;
    const result = await publishAPackage(pkg, access, getReleaseTag(tag), publishTool);
    publishResult.push(result);
    // if publish error in sync mode will stop publish
    if (!result.published) {
      return publishResult;
    }
  }

  return publishResult;
}

async function publishAPackage(
  pkg: Package,
  access: AccessType,
  tag: string,
  publishTool: npmUtils.PublishTool
): Promise<PublishedResult> {
  const { name, version, publishConfig } = pkg.packageJson;

  info(`Publishing ${chalk.cyan(`"${name}"`)} at ${chalk.green(`"${version}"`)}`);

  const publishDir = publishConfig?.directory ? join(pkg.dir, publishConfig.directory) : pkg.dir;

  const { published } = await npmUtils.publish(name, {
    publishTool,
    cwd: pkg.dir,
    publishDir,
    access: publishConfig?.access || access,
    tag
  });

  return {
    name,
    newVersion: version,
    published
  };
}

async function getUnpublishedPackages(packages: Array<Package>) {
  const verifyMessage = `${chalk.cyan('info')} Verifying package version information`;
  const dl = dynamicLog(verifyMessage);
  let count = 0;
  dl.update(` (${count}/${packages.length})`);

  const results: Array<PkgInfo> = await Promise.all(
    packages.map(async ({ packageJson }) => {
      const response = await npmUtils.infoAllow404(packageJson);

      dl.update(` (${++count}/${packages.length})`);

      let publishedState: PublishedState = 'never';
      if (response.published) {
        publishedState = 'published';
      }

      return {
        name: packageJson.name,
        localVersion: packageJson.version,
        publishedState,
        publishedVersions: response.pkgInfo.versions || []
      };
    })
  );

  dl.close();

  const packagesToPublish: Array<PkgInfo> = [];
  const packagesToSkip: Array<PkgInfo> = [];

  for (const pkgInfo of results) {
    const { localVersion, publishedVersions } = pkgInfo;
    if (!publishedVersions.includes(localVersion)) {
      packagesToPublish.push(pkgInfo);
    } else {
      packagesToSkip.push(pkgInfo);
    }
  }

  if (packagesToSkip.length) {
    warn(`The following packages version already exist in npm,skip publish`);
    packagesToSkip.forEach(({ name, localVersion }) => {
      log(`     ${name}: ${chalk.green(localVersion)}`);
    });
  }

  return packagesToPublish;
}
