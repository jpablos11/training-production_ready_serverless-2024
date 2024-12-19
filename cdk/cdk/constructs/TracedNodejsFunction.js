const { Construct } = require('constructs')
const { Tracing } = require('aws-cdk-lib/aws-lambda')
const { NodejsFunction, NodejsFunctionProps } = require('aws-cdk-lib/aws-lambda-nodejs')

class TracedNodejsFunction extends NodejsFunction {
  /**
   * @param {Construct} scope 
   * @param {string} id 
   * @param {NodejsFunctionProps} props 
   */
  constructor(scope, id, props) {
    props.tracing = Tracing.ACTIVE

    super(scope, id, props)
  }
}

module.exports = {
  TracedNodejsFunction
}