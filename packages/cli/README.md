# evem

This is evem's cli tool, which is used to track changes and release version.

## Evem command

evem contains the following commands

```
usage: evem [-h] [-s] <command> ...

Make the version release more efficient.

Positional arguments:
  <command>
    change      Generate changes summary
    version     Apply modified packages version
    publish     Publish package with release version changes
    init        Init evem basic config

Optional arguments:
  -h, --help    Show this help message and exit.
  -s, --silent  Silent execution without outputting any logs

For detailed help about a specific command, use: evem <command> -h
```

## Usage

## install

```shell
npx evem init
or
npm install -g evem
```



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

This step will actually carry out the release operation. He will verify your package version and execute npm pubish.

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



