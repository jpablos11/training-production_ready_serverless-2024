const { Stack, Fn } = require('aws-cdk-lib')
const { Runtime, Code, Function } = require('aws-cdk-lib/aws-lambda')
const { RestApi, LambdaIntegration, AuthorizationType, CfnAuthorizer } = require('aws-cdk-lib/aws-apigateway')
const { NodejsFunction } = require('aws-cdk-lib/aws-lambda-nodejs')
const { PolicyStatement, Effect } = require('aws-cdk-lib/aws-iam')

class ApiStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props)

    const api = new RestApi(this, `${props.stageName}-MyApi`, {
      deployOptions: {
        stageName: props.stageName
      }
    })

    const apiLogicalId = this.getLogicalId(api.node.defaultChild)

    const getIndexFunction = new NodejsFunction(this, 'GetIndex', {
      runtime: Runtime.NODEJS_18_X,
      handler: 'handler',
      entry: 'functions/get-index.js',
      bundling: {
        commandHooks: {
          afterBundling(inputDir, outputDir) {
            return [
              `mkdir ${outputDir}/static`,
              `cp ${inputDir}/static/index.html ${outputDir}/static/index.html`
            ]
          },
          beforeBundling() {},
          beforeInstall() {}
        }
      },
      environment: {
        restaurants_api: Fn.sub(`https://\${${apiLogicalId}}.execute-api.\${AWS::Region}.amazonaws.com/${props.stageName}/restaurants`),
        cognito_user_pool_id: props.cognitoUserPool.userPoolId,
        cognito_client_id: props.webUserPoolClient.userPoolClientId
      }
    })

    const getRestaurantsFunction = new Function(this, 'GetRestaurants', {
      runtime: Runtime.NODEJS_18_X,
      handler: 'get-restaurants.handler',
      code: Code.fromAsset('functions'),
      environment: {
        default_results: '8',
        restaurants_table: props.restaurantsTable.tableName
      }
    })
    props.restaurantsTable.grantReadData(getRestaurantsFunction)

    const searchRestaurantsFunction = new Function(this, 'SearchRestaurants', {
      runtime: Runtime.NODEJS_18_X,
      handler: 'search-restaurants.handler',
      code: Code.fromAsset('functions'),
      environment: {
        default_results: '8',
        restaurants_table: props.restaurantsTable.tableName
      }
    })
    props.restaurantsTable.grantReadData(searchRestaurantsFunction)    

    const getIndexLambdaIntegration = new LambdaIntegration(getIndexFunction)
    const getRestaurantsLambdaIntegration = new LambdaIntegration(getRestaurantsFunction)
    const searchRestaurantsLambdaIntegration = new LambdaIntegration(searchRestaurantsFunction)

    const cognitoAuthorizer = new CfnAuthorizer(this, 'CognitoAuthorizer', {
      name: 'CognitoAuthorizer',
      type: 'COGNITO_USER_POOLS',
      identitySource: 'method.request.header.Authorization',
      providerArns: [props.cognitoUserPool.userPoolArn],
      restApiId: api.restApiId,
    })

    api.root.addMethod('GET', getIndexLambdaIntegration)
    const restaurantsResource = api.root.addResource('restaurants')
    restaurantsResource.addMethod('GET', getRestaurantsLambdaIntegration, {
        authorizationType: AuthorizationType.IAM
      })
    restaurantsResource.addResource('search')
      .addMethod('POST', searchRestaurantsLambdaIntegration, {
        authorizationType: AuthorizationType.COGNITO,
        authorizer: {
          authorizerId: cognitoAuthorizer.ref
        }
      })

    const apiInvokePolicy = new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ['execute-api:Invoke'],
      resources: [
        Fn.sub(`arn:aws:execute-api:\${AWS::Region}:\${AWS::AccountId}:\${${apiLogicalId}}/${props.stageName}/GET/restaurants`)
      ]
    })
    getIndexFunction.role?.addToPrincipalPolicy(apiInvokePolicy)
  }
}

module.exports = { ApiStack }