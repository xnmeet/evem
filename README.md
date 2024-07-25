# EVEM

<div align="center"><img src="https://p3-infra.elabpic.com/tos-cn-i-ax5x5hote5/1cb02dc31f834262a19ba426ba04d4c7~tplv-ax5x5hote5-image.image" alt="Logo" height="200"></div>

<p align="center">
  <a href="https://npmjs.com/package/evem"><img src="https://img.shields.io/npm/v/evem.svg" alt="npm package"></a>
  <a href="https://nodejs.org/en/about/previous-releases"><img src="https://img.shields.io/node/v/evem.svg" alt="node compatibility"></a>
   <a href="https://pnpm.io/"><img src="https://img.shields.io/badge/maintained-pnpm-orange" alt="node compatibility"></a>
</p>
<br/>

English | [简体中文](./README.zh-CN.md)

Evem is designed with a simple and easy-to-manage concept. A lot of excellent practices have been drawn from rush and changesets. If you have used these two tools before, you can migrate to evem faster and experience a simpler release process.

❯  ✨  **Easy to use** Whether it is stable or prerelease, there are no additional operational costs and the process is consistent.<br>

❯  💡  **Support yarn/pnpm/rush** Consistent performance in multiple scenarios.<br>

❯  🎯  **On-demand release**  Now you can choose to publish only part of the package instead of selecting all every time, and evem will automatically help you calculate the specified packages to be published and their downstream dependencies.<br>

❯  🪁  **Change records are easier to read and management** Change logs divided by package name can be more conveniently searched and managed.<br>

❯  🚀  **Support event callbacks for the list of pending releases** Using event-emitter to obtain the list of pending releases is very useful for actions such as notification that require the use of the results.<br>

❯  🎉  **Support publishing in order of dependency relationship** Publishing from bottom to top according to the dependency relationship can effectively avoid errors in downstream dependencies' versions.<br>

❯  🎨  **Help you choose the package you need to publish**  Can support generating change logs based on the differences between development branches and main branches.<br>



## Install

```shell
npx evem init
or
npm install -g evem
```

## Example

### evem init

If you are a new repository, you can run `evem init` to complete the initialization.

```shell
evem init

➜ evem init
🐳  info Detected management tool pnpm
🐳  success Evem have been init 🎉
```



### evem change

This action will generate changes for changed packages。The changed packages comes from the diff difference between the current branch and the default branch you specified.

```shell
evem change
```

> It should be noted that you need to submit your changes before executing `evem change`. The reason for this is to avoid that the changes in your workspace are not intended to be submitted, but unnecessary changes are generated.

In addition, If you want to generate a changelog for a specified package regardless of whether it has actually changed, you can use the `--to` parameter, which is different from the default change. The default change is the difference calculated based on the diff result.

```
evem change --to evem-logger
```

More help

`evem change -h`

```
usage: evem change [-h] [-v] [-t TO]

Generate changes summary

Optional arguments:
  -h, --help      Show this help message and exit.
  -v, --verbose   If specified, log information useful for debugging
  -t TO, --to TO  Specify the package name that needs to generate the change
                  log.
```

### evem version

This command will generate a new version for you according to the changes file, and then generate a changelog.

> Note that this operation will cause file changes.

```
evem version
```

Of course, you can also specify packages to generate change logs.

```
evem version --to evem-logger
```

If you want to release the pre version, you just need to do this.

```
evem version --pre beta // this will auto bump version like beta.0、beta.1 ...
or
evem version --pre beta.11 // this will bump version by specified version beta.11
```



More help

`evem version -h`

```
usage: evem version [-h] [--pre PRE_NAME] [-v] [-t TO]

Apply modified packages version

Optional arguments:
  -h, --help      Show this help message and exit.
  -t TO, --to TO  You can specify the package name that needs to generate the
                  change log. Instead of applying all.
  --pre PRE_NAME  Prerelease version name,It can be a specific version number
                  or version type,like:beta or beta.1
  --only-none     Release packages with change type of "none" only, this
                  option needs to be used with "--pre".
  --list          Display only the result of the version without actually
                  applying the version.
  -v, --verbose   If specified, log information useful for debugging
```

###  evem publish

This step will actually carry out the release operation. He will verify your package version and execute npm publish.

```shell
evem publish
```

Similarly, publishing also supports the release of specified packages.

```
evem publish --to evem-logger
```

You can specify different tags for the versions you release, such as specifying `beta` as the corresponding tag when releasing a `beta` version.

```
evem publish --tag beta
```

More help

`evem publish -h`

```
usage: evem publish [-h] [--tag TAG_NAME] [-t TO] [-n] [-v]
Publish package with release version changes

Optional arguments:
  -h, --help        Show this help message and exit.
  --tag TAG_NAME    Publish tag, like:beta/alpha.It will be use when npm
                    publish and git tag
  -t TO, --to TO    Specify the package name that needs to generate the
                    change log.
  -n, --no-git-tag  If specified, Will not tag the current commits
  -v, --verbose     If specified, log information useful for debugging
```

## Advanced usage

Usually we combine the release process with CI to perform more customized and automated operations. Evem has gone through a lot of practice in this regard, which can help you easily achieve this.

### Regular release script

If your repository is a relatively clean tool library, you can perform full builds and execute releases each time. Then we recommend that you refer to the release process of  [publish-alpha](./publish-alpha.sh) , [publish-beta](./publish-beta.sh) , and [publish-stable](./publish-stable.sh) in the Evem repository，You can easily complete automated releases by combining them with your github-ci.

### On-demand release

Usually, our business warehouse contains many project packages, and full builds take too much time. We hope to build only the changed and to-be-released packages during publishing to improve efficiency. Evem provides an API that can easily help you achieve this.

```tsx
import { Evem, EventCoreOn, type OnVersionPlanData } from 'evem';

async function publishFlow() {
  const versionCli = new Evem();
  const evemParams = ['version'];

  // example: Assuming you are releasing a beta version.
  // In fact, the parameters here are exactly the same as in CLI,
  // and you can combine any parameters you need here.
  evemParams.push(...['--pre', 'beta']);

  EventCoreOn.onVersionPlan(async (data: OnVersionPlanData[]) => {
    console.log(data); // you can get version result here
    // You can do on-demand building here.
    // prepare build
    // ...

    const publishCli = new Evem();
    await publishCli.execute(['publish', '--tag', 'beta']);
  });

  await versionCli.execute(evemParams);
}

publishFlow();
```

Evem can be used directly in the ts/js file to complete any commands required for publishing. The parameters are consistent with the terminal.

## License

Evem reused some excellent implementations of [changsets](https://github.com/changesets/changesets) and [@rushstack/node-core-library](https://github.com/microsoft/rushstack) in the release, these two libraries are also based on the MIT protocol.

Made with 💛

Published under [MIT License](./LICENSE).