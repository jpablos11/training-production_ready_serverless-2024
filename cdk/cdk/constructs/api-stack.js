const { Stack } = require('aws-cdk-lib')
const { Runtime, Code, Function } = require('aws-cdk-lib/aws-lambda')
const { RestApi, LambdaIntegration } = require('aws-cdk-lib/aws-apigateway')

class ApiStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props)

    const lambdaFunction = new Function(this, 'HandlerFunction', {
      runtime: Runtime.NODEJS_18_X,
      handler: 'handler.hello',
      code: Code.fromAsset('functions'),
    })

    const api = new RestApi(this, `${props.stageName}-MyApi`, {
      deployOptions: {
        stageName: props.stageName
      }
    })

    const lambdaIntegration = new LambdaIntegration(lambdaFunction)
    api.root.addMethod('GET', lambdaIntegration)
  }
}

module.exports = { ApiStack }