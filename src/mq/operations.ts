// rabbitmq-operations.ts
import MQConnection from './connect';

export async function sendMessage(queueName: string, message: string): Promise<void> {
  const connection = MQConnection.getInstance();
  const channel = connection.getChannel();

  await channel.assertQueue(queueName, { durable: false });
  channel.sendToQueue(queueName, Buffer.from(message));
  console.log(`Sent message to queue ${queueName}: ${message}`);
}

const MAX_CONCURRENT_MESSAGES = 1;

export async function consumeMessages(queueName: string, callback: (msg: string) => Promise<void>): Promise<void> {
  const connection = MQConnection.getInstance();
  const channel = connection.getChannel();

  await channel.assertQueue(queueName, { durable: true });
  console.log(`Waiting for messages from queue ${queueName}`);

  const processingMessages: Set<Promise<void>> = new Set();

  channel.consume(queueName, async (msg) => {
    if (msg !== null) {
      const content = msg.content.toString();
      const processing = callback(content)
        .then(() => channel.ack(msg))
        .catch((error) => {
          console.error('Error processing message:', error);
          // Optionally, you can reject the message or handle it differently
        })
        .finally(() => processingMessages.delete(processing));

      processingMessages.add(processing);

      // Limit the number of concurrent processing
      if (processingMessages.size >= MAX_CONCURRENT_MESSAGES) {
        await Promise.race(processingMessages);
      }
    }
  }, { noAck: false });
}