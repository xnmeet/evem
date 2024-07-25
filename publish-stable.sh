#!/usr/bin/env bash

pnpm install

check_results=`pnpm evem version --list`
echo "command(pnpm evem version --list) results are: $check_results"
if [[ $check_results =~ "[]" ]]
then
    exit 0
else
  pnpm evem version

  pnpm build

  pnpm evem publish
  git add :/**/package.json
  git commit -m "chore: bump versions" -n

  git add .evem/changes/*
  git add :/**/CHANGELOG.json
  git add :/**/CHANGELOG.md
  git commit -m "chore: update changelogs" -n

  git push origin HEAD:$(git symbolic-ref --short HEAD) --verbose --no-verify --follow-tags
 fi

