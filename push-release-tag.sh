#!/usr/bin/env bash

#####
# Push a tag of this release if it doesn't exist
# CAlled after deploy. Uses a ssh deploy key: github_deploy_key
# Key was generated: ssh-keygen -t rsa -b 4096 -C "travis-ci" -f github_deploy_key -N ''
# and added as an encrypted file using: travis encrypt-file github_deploy_key github_deploy_key.enc -a before_deploy
#####


# exit on errors
set -e

git checkout -- package.json

PKG_VER=v$(node -p "require('./package.json').version")

echo "Version from package.json: $PKG_VER"

if npx git-semver-tags | grep "$PKG_VER"; then
    echo "$PKG_VER tag already exists. Nothing to do. Skipping."
    exit 0
fi

git config --local user.email "builds@travis-ci.com"
git config --local user.name "Travis CI"
git tag "$PKG_VER"
git remote add origin-ssh git@github.com:functionalone/serverless-iam-roles-per-function.git
echo "Git remotes:"
git remote -v
GIT_SSH_COMMAND='ssh -i github_deploy_key -o IdentitiesOnly=yes' git push origin-ssh "$PKG_VER"
