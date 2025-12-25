// rabbitmq-operations.ts
import MQConnection from './connect';

export async function sendMessage(queueName: string, message: string): Promise<void> {
  const connection = MQConnection.getInstance();
  const channel = connection.getChannel();

  await channel.assertQueue(queueName, { durable: false });
  channel.sendToQueue(queueName, Buffer.from(message));
  console.log(`Sent message to queue ${queueName}: ${message}`);
}

export async function consumeMessages(
  queueName: string,
  callback: (
    message: string,
    ack: () => void,
    nack: (requeue: boolean) => void,
    headers?: Record<string, unknown>
  ) => Promise<void>
): Promise<void> {
  const connection = MQConnection.getInstance();
  const channel = connection.getChannel();

  await channel.assertQueue(queueName, { 
    durable: true,
    arguments: {
      'x-dead-letter-exchange': `${queueName}_dlx`,
      'x-dead-letter-routing-key': ''
    }
  });
  console.log(`Waiting for messages from queue ${queueName}`);
  
  await channel.prefetch(1);

  channel.consume(queueName, async (msg) => {
    if (msg === null) return;

    const message = msg.content.toString();
    const headers = msg.properties.headers;
    let handled = false;

    const ack = () => {
      if (!handled) {
        channel.ack(msg);
        handled = true;
      }
    };

    const nack = (requeue: boolean) => {
      if (!handled) {
        channel.nack(msg, false, requeue);
        handled = true;
      }
    };

    try {
      await callback(message, ack, nack, headers);

      // If callback didn't call ack/nack, we should nack to avoid message loss
      if (!handled) {
        console.warn(`Message was not acknowledged by callback, nacking: ${message}`);
        nack(false);
      }
    } catch (error) {
      console.error('Error processing message:', error);
      // Only nack if not already handled
      if (!handled) {
        nack(false);
      }
    }
  }, { noAck: false });
}