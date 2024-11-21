#!/usr/bin/env node

const cdk = require('aws-cdk-lib')
const { ApiStack } = require('./constructs/api-stack')

const app = new cdk.App()
let stageName = app.node.tryGetContext('stageName')

if (!stageName) {
  console.log('Defaulting stage name to dev')
  stageName = 'dev'
}

new ApiStack(app, `ApiStack-${stageName}`, { stageName })