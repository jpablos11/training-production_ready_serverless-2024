const { Function } = require('aws-cdk-lib/aws-lambda')

class LambdaEnvVarsAspect {
  constructor(stageName) {
    this.stageName = stageName
  }

  visit(node) {
    if (node instanceof Function) {
      if (this.stageName === 'prod') {
        node.addEnvironment('LOG_LEVEL', 'error')
      } else {
        node.addEnvironment('LOG_LEVEL', 'info')
      }
      node.addEnvironment('serviceName', this.serviceName)
      node.addEnvironment('POWERTOOLS_LOGGER_SAMPLE_RATE', '0.1')
      node.addEnvironment('POWERTOOLS_LOGGER_LOG_EVENT', 'true')
    }
  }
}

module.exports = { LambdaEnvVarsAspect }