const { Stack } = require('aws-cdk-lib')
const { UserPool, UserPoolClient } = require('aws-cdk-lib/aws-cognito')

class CognitoStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props)

    const userPool = new UserPool(this, 'UserPool', {
      selfSignUpEnabled: true,
      signInCaseSensitive: false,
      autoVerify: {
        email: true
      },
      signInAliases: {
        email: true
      },
      passwordPolicy: {
        minLength: 8,
        requireDigits: true,
        requireLowercase: true,
        requireSymbols: true,
        requireUppercase: true
      },
      standardAttributes: {
        givenName: {
          required: true,
          mutable: true
        },
        familyName: {
          required: true,
          mutable: true
        },
        email: {
          required: true,
          mutable: true
        }
      }      
    })

    const webUserPoolClient = new UserPoolClient(this, 'WebUserPoolClient', {
      userPool,
      authFlows: {
        userSrp: true
      },
      preventUserExistenceErrors: true
    })

    new UserPoolClient(this, 'ServerUserPoolClient', {
      userPool,
      authFlows: {
        adminUserPassword: true
      },
      preventUserExistenceErrors: true
    })

    this.cognitoUserPool = userPool
    this.webUserPoolClient = webUserPoolClient
  }
}

module.exports = { CognitoStack }