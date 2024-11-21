const { Stack } = require('aws-cdk-lib')
const { Runtime, Code, Function } = require('aws-cdk-lib/aws-lambda')
const { RestApi, LambdaIntegration } = require('aws-cdk-lib/aws-apigateway')

class ApiStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props)

    const getIndexFunction = new Function(this, 'GetIndex', {
      runtime: Runtime.NODEJS_18_X,
      handler: 'get-index.handler',
      code: Code.fromAsset('functions'),
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

    const api = new RestApi(this, `${props.stageName}-MyApi`, {
      deployOptions: {
        stageName: props.stageName
      }
    })

    const getIndexLambdaIntegration = new LambdaIntegration(getIndexFunction)
    const getRestaurantsLambdaIntegration = new LambdaIntegration(getRestaurantsFunction)
    api.root.addMethod('GET', getIndexLambdaIntegration)
    api.root.addResource('restaurants').addMethod('GET', getRestaurantsLambdaIntegration)
  }
}

module.exports = { ApiStack }