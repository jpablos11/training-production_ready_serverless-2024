const { Stack } = require('aws-cdk-lib')
const { Table, AttributeType, BillingMode } = require('aws-cdk-lib/aws-dynamodb')

class DatabaseStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props)

    const restaurantsTable = new Table(this, 'RestaurantsTable', {
      partitionKey: {
        name: 'name',
        type: AttributeType.STRING,
      },
      billingMode: BillingMode.PAY_PER_REQUEST
    })

    const ordersTable = new Table(this, 'OrdersTable', {
      partitionKey: {
        name: 'id',
        type: AttributeType.STRING,
      },
      billingMode: BillingMode.PAY_PER_REQUEST
    })

    const idempotencyTable = new Table(this, 'IdempotencyTable', {
      partitionKey: {
        name: 'id',
        type: AttributeType.STRING,
      },
      timeToLiveAttribute: 'expiration',
      billingMode: BillingMode.PAY_PER_REQUEST
    })

    this.restaurantsTable = restaurantsTable
    this.ordersTable = ordersTable
    this.idempotencyTable = idempotencyTable
  }
}

module.exports = { DatabaseStack }