#!/bin/bash

echo "linting @squad/hardhat"
yarn workspace @squad/hardhat lint
echo "linting @squad/polywrap"
yarn workspace @squad/polywrap lint
echo "linting @squad/subgraph"
yarn workspace @squad/subgraph lint
echo "linting @squad/lib"
yarn workspace @squad/lib lint
echo "linting @squad/wallet-connect"
yarn workspace @squad/wallet-connect lint
