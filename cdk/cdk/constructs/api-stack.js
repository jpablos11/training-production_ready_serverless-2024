const { Stack, Fn, CfnOutput } = require('aws-cdk-lib')
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

    const getRestaurantsFunction = new NodejsFunction(this, 'GetRestaurants', {
      runtime: Runtime.NODEJS_18_X,
      handler: 'handler',
      entry: 'functions/get-restaurants.js',
      environment: {
        middy_cache_enabled: "true",
        middy_cache_expiry_milliseconds: "60000", // 1 mins
        service_name: props.serviceName,
        stage_name: props.stageName,
        restaurants_table: props.restaurantsTable.tableName
      }
    })
    props.restaurantsTable.grantReadData(getRestaurantsFunction)
    getRestaurantsFunction.role.addToPrincipalPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['ssm:GetParameters*'],
        resources: [
          Fn.sub(`arn:aws:ssm:\${AWS::Region}:\${AWS::AccountId}:parameter/${props.serviceName}/${props.stageName}/get-restaurants/config`)
        ]
      })
    )
    
    const searchRestaurantsFunction = new NodejsFunction(this, 'SearchRestaurants', {
      runtime: Runtime.NODEJS_18_X,
      handler: 'handler',
      entry: 'functions/search-restaurants.js',
      environment: {
        middy_cache_enabled: "true",
        middy_cache_expiry_milliseconds: "60000", // 1 mins
        service_name: props.serviceName,
        stage_name: props.stageName,
        restaurants_table: props.restaurantsTable.tableName
      }
    })
    props.restaurantsTable.grantReadData(searchRestaurantsFunction)
    searchRestaurantsFunction.role.addToPrincipalPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['ssm:GetParameters*'],
        resources: [
          Fn.sub(`arn:aws:ssm:\${AWS::Region}:\${AWS::AccountId}:parameter/${props.serviceName}/${props.stageName}/search-restaurants/config`)
        ]
      })
    )

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

    new CfnOutput(this, 'ApiUrl', {
      value: api.url
    })

    new CfnOutput(this, 'CognitoServerClientId', {
      value: props.serverUserPoolClient.userPoolClientId
    })
  }
}

module.exports = { ApiStack }