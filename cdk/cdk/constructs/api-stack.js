const { Stack, Fn } = require('aws-cdk-lib')
const { Runtime, Code, Function } = require('aws-cdk-lib/aws-lambda')
const { RestApi, LambdaIntegration } = require('aws-cdk-lib/aws-apigateway')
const { NodejsFunction } = require('aws-cdk-lib/aws-lambda-nodejs')

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
        restaurants_api: Fn.sub(`https://\${${apiLogicalId}}.execute-api.\${AWS::Region}.amazonaws.com/${props.stageName}/restaurants`)
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

    const getIndexLambdaIntegration = new LambdaIntegration(getIndexFunction)
    const getRestaurantsLambdaIntegration = new LambdaIntegration(getRestaurantsFunction)
    api.root.addMethod('GET', getIndexLambdaIntegration)
    api.root.addResource('restaurants').addMethod('GET', getRestaurantsLambdaIntegration)
  }
}

module.exports = { ApiStack }