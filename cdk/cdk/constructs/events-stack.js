const { Stack } = require('aws-cdk-lib')
const { EventBus } = require('aws-cdk-lib/aws-events')

class EventsStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props)

    const orderEventBus = new EventBus(this, 'OrderEventBus', {
      eventBusName: `${props.serviceName}-${props.stageName}-order-events`,
    })

    this.orderEventBus = orderEventBus
  }
}

module.exports = { EventsStack }