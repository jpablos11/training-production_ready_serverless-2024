const { Stack } = require('aws-cdk-lib')
const { Table, AttributeType, BillingMode } = require('aws-cdk-lib/aws-dynamodb')

class DatabaseStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props)

    const restaurantstable = new Table(this, 'RestaurantsTable', {
      partitionKey: {
        name: 'name',
        type: AttributeType.STRING,
      },
      billingMode: BillingMode.PAY_PER_REQUEST
    })

    this.restaurantsTable = restaurantstable
  }
}

module.exports = { DatabaseStack }