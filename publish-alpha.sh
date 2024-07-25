#!/usr/bin/env bash

pnpm install

check_results=`pnpm evem version --list`
echo "command(pnpm evem version --list) results are: $check_results"
if [[ $check_results =~ "[]" ]]
then
    exit 0
else
  pnpm evem version --pre alpha.x$(git rev-parse --short HEAD)

  pnpm build

  pnpm evem publish --tag alpha -n
 fi




