#!/usr/bin/env node

const cdk = require('aws-cdk-lib')
const { ApiStack } = require('./constructs/api-stack')
const { DatabaseStack } = require('./constructs/database-stack')
const { CognitoStack } = require('./constructs/cognito-stack')

const app = new cdk.App()
let stageName = app.node.tryGetContext('stageName')
let ssmStageName = app.node.tryGetContext('ssmStageName')

if (!stageName) {
  console.log('Defaulting stage name to dev')
  stageName = 'dev'
}

if (!ssmStageName) {
  console.log(`Defaulting SSM stage name to "stageName": ${stageName}`)
  ssmStageName = stageName
}

const dbStack = new DatabaseStack(app, `DatabaseStack-${stageName}`, { stageName })
const cognitoStack = new CognitoStack(app, `CognitoStack-${stageName}`, { stageName })
new ApiStack(app, `ApiStack-${stageName}`, {
  serviceName: 'workshop-jorge',
  stageName,
  ssmStageName,
  restaurantsTable: dbStack.restaurantsTable,
  cognitoUserPool: cognitoStack.cognitoUserPool,
  webUserPoolClient: cognitoStack.webUserPoolClient,
  serverUserPoolClient: cognitoStack.serverUserPoolClient
})
