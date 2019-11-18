#!/usr/bin/env bash

set -ex

cd $(dirname $0)/data

BAB_TAG=v$(node -p 'require("@gerhobbelt/babel-parser/package.json").version')

if [ ! -d babel-parser ]
then
	if [ -d /tmp/babel ]
	then
    	rm -rf /tmp/babel
	fi
    git clone --branch "$BAB_TAG" --depth 1 \
        https://github.com/GerHobbelt/babel.git /tmp/babel
    mv /tmp/babel/packages/babel-parser .
    rm -rf /tmp/babel
fi

if [ ! -d graphql-tools-src ]
then
	if [ -d /tmp/graphql-tools ]
	then
    	rm -rf /tmp/graphql-tools
    fi
    git clone --depth 1 https://github.com/apollographql/graphql-tools.git /tmp/graphql-tools
    pushd /tmp/graphql-tools
    git reset --hard 90e37c477225e56edfacc9f2a1a8336c766de93b
    popd
    mv /tmp/graphql-tools/src \
       graphql-tools-src
    rm -rf /tmp/graphql-tools
fi

cd .. # back to the recast/test/ directory

exec mocha --check-leaks --reporter spec --full-trace $@ run.js
