# EVEM

<div align="center"><img src="https://p3-infra.elabpic.com/tos-cn-i-ax5x5hote5/1cb02dc31f834262a19ba426ba04d4c7~tplv-ax5x5hote5-image.image" alt="Logo" height="200"></div>

<p align="center">
  <a href="https://npmjs.com/package/evem"><img src="https://img.shields.io/npm/v/evem.svg" alt="npm package"></a>
  <a href="https://nodejs.org/en/about/previous-releases"><img src="https://img.shields.io/node/v/evem.svg" alt="node compatibility"></a>
   <a href="https://pnpm.io/"><img src="https://img.shields.io/badge/maintained-pnpm-orange" alt="node compatibility"></a>
</p>
<br/>

[English](./README.md) | 简体中文

**Evem** 以简单易于管理的理念设计而成。从 `rush` 和 `changesets` 中汲取了许多优秀的实践经验。如果您以前使用过这两个工具，那么您可以更快地迁移到 **Evem**，并体验一个更简单的发布流程。

❯  ✨  **易于使用** 无论是稳定版还是预发布版，都没有额外的操作成本，并且流程保持一致。<br>

❯  💡  **支持 yarn/pnpm/rush** 在不同管理方式下表现一致。<br>

❯  🎯  **按需发布**  现在您可以选择仅发布包的一部分，而不是每次都选择全部。evem将自动帮助您计算要发布的指定软件包及其下游依赖项。<br>

❯  🪁  **变更集更易度和管理** 变更日志按包名分组，可以更方便地搜索、修改和管理。<br>

❯  🚀  **支持通过事件回调获取待发布列表** 使用 event-emitter 获取待处理发布列表非常有用，特别是对于需要使用结果的通知等操作。<br>

❯  🎉  **支持按依赖关系顺序发布** 根据依赖关系从底层向顶层发布可以有效避免下游依赖版本的错误。<br>

❯  🎨  **帮助您选择需要发布的包**  可以支持根据开发分支和主分支之间的差异生成变更日志。<br>



## 安装

```shell
npx evem init
or
npm install -g evem
```

## 使用示例

### evem init

如果你是一个新的仓库, 你可以通过执行 `evem init` 来完成 evem 的初始化.

```shell
evem init

➜ evem init
🐳  info Detected management tool pnpm
🐳  success Evem have been init 🎉
```



### evem change

这将通过对比当前分支和目标分支（默认 main）之间的差异文件，并自动计算出需要生成变更记录的包，并通过交互式的输入来完成变更记录的生成。

```shell
evem change
```

> 值得注意的事你应该先提交你改动的代码，然后执行 `evem change` 来为这些改动生成变更记录. 这样做是为了避免工作区中的更改不打算提交，但是生成了不必要的更改.

此外，如果您想为指定的包生成变更记录，无论它是否已实际更改，您可以使用`--to`参数，该参数与默认更改不同。默认更改是根据差异结果计算的差异。

```
evem change --to evem-logger
```

更多命令参数

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

此命令将根据记录的变更文件为您计算并生成新版本，以及更改日志（changelog）。

> 注意：这个操作可能会消费变更记录即删除 changes 目录对应的变更记录（正式版发布时这个操作才会执行）

```
evem version
```

当然你也可以为指定的包进行版本计算和变更日志的生成

```
evem version --to evem-logger
```

如果你想发布预览版本，你只需要像下面这样做

```
evem version --pre beta // 这会自动按递增顺序变更版本，比如 beta.0、beta.1 ...
or
evem version --pre beta.11 // 这会按指定的版本修改对应包的 version，比如 beta.11
```



更多命令参数
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

这一步将实际执行发布操作。他将验证包版本并执行npm publish命令。

```shell
evem publish
```

同样，发布也支持发布指定包

```
evem publish --to evem-logger
```

您可以为发布的不同版本指定不同的标签，例如在发布`beta`版本时指定`beta`作为相应的标签。

```
evem publish --tag beta
```

更多命令参数

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

## 高级用法

通常，我们将发布过程与 CI 相结合，以执行更多定制和自动化的操作。Evem 在这方面经历了很多实践，这可以帮助你轻松实现这一点。

### 常规发布脚本

如果您的代码库是一个相对干净的工具库，每次都可以执行完整构建并发布版本。那么我们建议您参考 Evem 的发布流程：  [publish-alpha](./publish-alpha.sh) , [publish-beta](./publish-beta.sh) , 以及 [publish-stable](./publish-stable.sh) ，通过将它们与您的github-ci相结合，您可以轻松完成自动发布.

### 按需发布

通常，我们的业务仓库包含许多项目包，完整构建需要太多时间。我们希望在发布期间只构建已更改和待发布的软件包，以提高效率。Evem提供了一个API，可以轻松帮助您实现这一目标。

```tsx
import { Evem, EventCoreOn, type OnVersionPlanData } from 'evem';

async function publishFlow() {
  const versionCli = new Evem();
  const evemParams = ['version'];

  // 例子: 假设你打算发布一个 beta 版本.
  // 实际上下面的参数和使用 evem cli 的命令参数是一致的,
  evemParams.push(...['--pre', 'beta']);

  EventCoreOn.onVersionPlan(async (data: OnVersionPlanData[]) => {
    console.log(data); // 这里你可以获取到待发布的包信息
    // 你可以在这里做按需构建.
    // 准备构建
    // ...

    const publishCli = new Evem();
    await publishCli.execute(['publish', '--tag', 'beta']);
  });

  await versionCli.execute(evemParams);
}

publishFlow();
```

Evem 可以直接在 `ts/js`文件中使用，以完成发布所需的任何命令。参数与终端一致。

## License

Evem reused some excellent implementations of [changsets](https://github.com/changesets/changesets) and [@rushstack/node-core-library](https://github.com/microsoft/rushstack) in the release, these two libraries are also based on the MIT protocol.

Made with 💛

Published under [MIT License](./LICENSE).