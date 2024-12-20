const { Stack, Fn, CfnOutput, CfnParameter } = require('aws-cdk-lib')
const { Runtime } = require('aws-cdk-lib/aws-lambda')
const { RestApi, LambdaIntegration, AuthorizationType, CfnAuthorizer } = require('aws-cdk-lib/aws-apigateway')
const { TracedNodejsFunction } = require('./TracedNodejsFunction')
const { PolicyStatement, Effect } = require('aws-cdk-lib/aws-iam')
const { StringParameter } = require('aws-cdk-lib/aws-ssm')

class ApiStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props)

    this.declareParameters(props)

    const api = new RestApi(this, `${props.stageName}-MyApi`, {
      deployOptions: {
        stageName: props.stageName,
        tracingEnabled: true
      }
    })

    const getIndexFunction = this.declareGetIndexFunction(props, api)
    const getRestaurantsFunction = this.declareGetRestaurantsFunction(props)
    const searchRestaurantsFunction = this.declareSearchRestaurantsFunction(props)
    const placeOrderFunction = this.declarePlaceOrderFunction(props)

    this.declareApiEndpoints(props, api, {
      getIndex: getIndexFunction,
      getRestaurants: getRestaurantsFunction,
      searchRestaurants: searchRestaurantsFunction,
      placeOrder: placeOrderFunction
    })

    this.declareOutputs(props, api)
  }

  declareParameters(props) {
    new CfnParameter(this, "KmsArnParameter", {
      type: "AWS::SSM::Parameter::Value<String>",
      default: `/${props.serviceName}/${props.ssmStageName}/kmsArn`
    })
  }

  /**
   * @param {RestApi} api
   */
  declareGetIndexFunction(props, api) {
    const apiLogicalId = this.getLogicalId(api.node.defaultChild)

    const getIndexFunction = new TracedNodejsFunction(this, 'GetIndex', {
      runtime: Runtime.NODEJS_22_X,
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
        orders_api: Fn.sub(`https://\${${apiLogicalId}}.execute-api.\${AWS::Region}.amazonaws.com/${props.stageName}/orders`),
        cognito_user_pool_id: props.cognitoUserPool.userPoolId,
        cognito_client_id: props.webUserPoolClient.userPoolClientId
      }
    })

    const apiInvokePolicy = new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ['execute-api:Invoke'],
      resources: [
        Fn.sub(`arn:aws:execute-api:\${AWS::Region}:\${AWS::AccountId}:\${${apiLogicalId}}/${props.stageName}/GET/restaurants`)
      ]
    })
    getIndexFunction.role.addToPrincipalPolicy(apiInvokePolicy)

    return getIndexFunction
  }

  declareGetRestaurantsFunction(props) {
    const getRestaurantsFunction = new TracedNodejsFunction(this, 'GetRestaurants', {
      runtime: Runtime.NODEJS_22_X,
      handler: 'handler',
      entry: 'functions/get-restaurants.js',
      environment: {
        middy_cache_enabled: "true",
        middy_cache_expiry_milliseconds: "60000", // 1 mins
        service_name: props.serviceName,
        ssm_stage_name: props.ssmStageName,
        restaurants_table: props.restaurantsTable.tableName
      }
    })
    props.restaurantsTable.grantReadData(getRestaurantsFunction)
    getRestaurantsFunction.role.addToPrincipalPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['ssm:GetParameters*'],
        resources: [
          Fn.sub(`arn:aws:ssm:\${AWS::Region}:\${AWS::AccountId}:parameter/${props.serviceName}/${props.ssmStageName}/get-restaurants/config`)
        ]
      })
    )

    return getRestaurantsFunction
  }

  declareSearchRestaurantsFunction(props) {
    const searchRestaurantsFunction = new TracedNodejsFunction(this, 'SearchRestaurants', {
      runtime: Runtime.NODEJS_22_X,
      handler: 'handler',
      entry: 'functions/search-restaurants.js',
      environment: {
        middy_cache_enabled: "true",
        middy_cache_expiry_milliseconds: "60000", // 1 mins
        service_name: props.serviceName,
        ssm_stage_name: props.ssmStageName,
        restaurants_table: props.restaurantsTable.tableName
      }
    })
    props.restaurantsTable.grantReadData(searchRestaurantsFunction)
    searchRestaurantsFunction.role.addToPrincipalPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['ssm:GetParameters*'],
        resources: [
          Fn.sub(`arn:aws:ssm:\${AWS::Region}:\${AWS::AccountId}:parameter/${props.serviceName}/${props.ssmStageName}/search-restaurants/config`),
          Fn.sub(`arn:aws:ssm:\${AWS::Region}:\${AWS::AccountId}:parameter/${props.serviceName}/${props.ssmStageName}/search-restaurants/secretString`)
        ]
      })
    )
    searchRestaurantsFunction.role.addToPrincipalPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['kms:Decrypt'],
        resources: [
          Fn.ref('KmsArnParameter')
        ]
      })
    )

    return searchRestaurantsFunction
  }

  declarePlaceOrderFunction(props) {
    const placeOrderFunction = new TracedNodejsFunction(this, 'PlaceOrder', {
      runtime: Runtime.NODEJS_22_X,
      handler: 'handler',
      entry: 'functions/place-order.js',
      environment: {                
        bus_name: props.orderEventBus.eventBusName
      }
    })
    props.orderEventBus.grantPutEventsTo(placeOrderFunction)

    return placeOrderFunction
  }

  /**
   * @param {RestApi} api
   */
  declareApiEndpoints(props, api, functions) {
    const cognitoAuthorizer = new CfnAuthorizer(this, 'CognitoAuthorizer', {
      name: 'CognitoAuthorizer',
      type: 'COGNITO_USER_POOLS',
      identitySource: 'method.request.header.Authorization',
      providerArns: [props.cognitoUserPool.userPoolArn],
      restApiId: api.restApiId,
    })

    // GET /
    api.root.addMethod('GET', new LambdaIntegration(functions.getIndex))

    const restaurantsResource = api.root.addResource('restaurants')

    // GET /restaurants
    restaurantsResource.addMethod(
      'GET', 
      new LambdaIntegration(functions.getRestaurants), 
      { authorizationType: AuthorizationType.IAM })

    // POST /restaurants/search
    restaurantsResource.addResource('search')
      .addMethod(
        'POST', 
        new LambdaIntegration(functions.searchRestaurants), 
        {
          authorizationType: AuthorizationType.COGNITO,
          authorizer: {
            authorizerId: cognitoAuthorizer.ref
          }
        })

    // POST /orders
    api.root.addResource('orders')
      .addMethod(
        'POST', 
        new LambdaIntegration(functions.placeOrder), 
        {
          authorizationType: AuthorizationType.COGNITO,
          authorizer: {
            authorizerId: cognitoAuthorizer.ref
          }
        })
  }

  declareOutputs(props, api) {
    new CfnOutput(this, 'ApiUrl', {
      value: api.url
    })

    new CfnOutput(this, 'CognitoServerClientId', {
      value: props.serverUserPoolClient.userPoolClientId
    })

    new StringParameter(this, 'ApiUrlParameter', {
      parameterName: `/${props.serviceName}/${props.stageName}/service-url`,
      stringValue: api.url
    })
  }
}

module.exports = { ApiStack }