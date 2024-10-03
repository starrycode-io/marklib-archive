// rabbitmq-operations.ts
import MQConnection from './connect';

export async function sendMessage(queueName: string, message: string): Promise<void> {
  const connection = MQConnection.getInstance();
  const channel = connection.getChannel();

  await channel.assertQueue(queueName, { durable: false });
  channel.sendToQueue(queueName, Buffer.from(message));
  console.log(`Sent message to queue ${queueName}: ${message}`);
}

export async function consumeMessages(queueName: string, callback: (msg: string) => void): Promise<void> {
  const connection = MQConnection.getInstance();
  const channel = connection.getChannel();

  await channel.assertQueue(queueName, { durable: false });
  console.log(`Waiting for messages from queue ${queueName}`);

  channel.consume(queueName, (msg) => {
    if (msg !== null) {
      const content = msg.content.toString();
      callback(content);
      channel.ack(msg);
    }
  });
}