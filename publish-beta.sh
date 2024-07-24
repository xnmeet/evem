#!/usr/bin/env bash

pnpm install

check_results=`pnpm evem version --list`
echo "command(pnpm evem version --list) results are: $check_results"
if [[ $check_results =~ "[]" ]]
then
    exit 0
else
  pnpm evem version --pre beta

  pnpm build

  pnpm evem publish --tag beta

  git add :/**/package.json
  git commit -m "chore: bump versions" -n
  git push origin HEAD:$(git symbolic-ref --short HEAD) --verbose --no-verify --follow-tags
 fi