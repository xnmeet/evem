# @evem/core

Here is the ability of all the cores used by evem.

```
.
├── change-file
├── change-log
├── change-manage
├── publish
├── schemes
├── types
└── utilities
```

## change-file

It is used to generate change-file, corresponding to those files in the changes directory. Read and consume the content in the changes directory at the same time, such as obtaining the changes file in the version.

## change-log

It is used to generate release logs, corresponding to CHANGELOG files, which can be read and generated.

## change-manage

The place where the changes are processed centrally is used to parse the changes directory and generate results to be released. During this period, the version may be changed to generate a change log. The core dependency of version operation

## publish

Publish action used.The main ability is to detect all package versions in the warehouse and determine whether it needs to be released to npm.

## schemes

It contains the structural verification of some necessary files, such as config.json, changelog.json, etc.

## utilities

Some tools and methods that all the above business capabilities rely on