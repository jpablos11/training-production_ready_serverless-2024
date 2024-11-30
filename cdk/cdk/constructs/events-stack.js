const { Stack } = require('aws-cdk-lib')
const { EventBus, Rule } = require('aws-cdk-lib/aws-events')
const { LambdaFunction } = require('aws-cdk-lib/aws-events-targets')
const { Topic } = require('aws-cdk-lib/aws-sns')
const { Function, Code, Runtime } = require('aws-cdk-lib/aws-lambda')

class EventsStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props)

    const orderEventBus = new EventBus(this, 'OrderEventBus', {
      eventBusName: `${props.serviceName}-${props.stageName}-order-events`,
    })

    this.orderEventBus = orderEventBus

    const restaurantNotificationTopic = new Topic(this, 'RestaurantNotificationTopic')

    const notifyRestaurantFunction = new Function(this, 'NotifyRestaurantFunction', {
      runtime: Runtime.NODEJS_18_X,
      handler: 'notify-restaurant.handler',
      code: Code.fromAsset('functions'),
      environment: {
        bus_name: orderEventBus.eventBusName,
        restaurant_notification_topic: restaurantNotificationTopic.topicArn
      }
    })
    orderEventBus.grantPutEventsTo(notifyRestaurantFunction)
    restaurantNotificationTopic.grantPublish(notifyRestaurantFunction)

    const rule = new Rule(this, 'Rule', {
      eventBus: orderEventBus,
      eventPattern: {
        source: ['big-mouth'],
        detailType: ['order_placed'],
      }
    })
    rule.addTarget(new LambdaFunction(notifyRestaurantFunction))
  }
}

module.exports = { EventsStack }