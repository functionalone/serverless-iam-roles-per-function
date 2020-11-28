#!/usr/bin/env bash

#####
# Modify package.json and package-lock.json version to include the current commit hash
#####


# exit on errors
set -e

if [[ "$TRAVIS_BRANCH" == release ]]; then
    echo "Not setting pre-release version as this is a build on release"
    exit 0
fi

# IMPORTANT: Make sure when writing sed command to use: sed -i "${INPLACE[@]}" 
# to be compatible with mac and linux
# sed on mac requires '' as param and on linux doesn't
if [[ "$(uname)" == Linux ]]; then
    INPLACE=()
else
    INPLACE=('')
fi

HASH=$(git rev-parse --short HEAD)

function replace_version {
    node -p "const p = require('./$1'); const fs = require('fs'); p.version = p.version + '-' + '$HASH'; fs.writeFileSync('$1', JSON.stringify(p,null, 2));" > /dev/null
}

replace_version package.json
replace_version package-lock.json
