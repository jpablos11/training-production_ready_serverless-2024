const { Stack } = require('aws-cdk-lib')
const { StateMachine, DefinitionBody } = require('aws-cdk-lib/aws-stepfunctions')

class OrderFlowStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props)

    const { 
      ordersTable, 
      orderEventBus, 
      restaurantNotificationTopic, 
      userNotificationTopic
    } = props

    const stateMachine = new StateMachine(this, 'OrderFlowStateMachine', {
      definitionBody: DefinitionBody.fromFile('cdk/state_machines/order-flow.asl.json'),
      definitionSubstitutions: {
        'ORDERS_TABLE_NAME': ordersTable.tableName,
        'EVENT_BUS_NAME': orderEventBus.eventBusName,
        'RESTAURANT_TOPIC_ARN': restaurantNotificationTopic.topicArn,
        'USER_TOPIC_ARN': userNotificationTopic.topicArn
      }
    })

    ordersTable.grantWriteData(stateMachine)
    orderEventBus.grantPutEventsTo(stateMachine)
    restaurantNotificationTopic.grantPublish(stateMachine)
    userNotificationTopic.grantPublish(stateMachine)
  }
}

module.exports = { OrderFlowStack }