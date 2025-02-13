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
    nack: (requeue?: boolean) => void
  ) => Promise<void>
): Promise<void> {
  const connection = MQConnection.getInstance();
  const channel = connection.getChannel();

  await channel.assertQueue(queueName, { durable: true });
  console.log(`Waiting for messages from queue ${queueName}`);
  
  await channel.prefetch(1);
  let isProcessing = false;

  channel.consume(queueName, async (msg) => {
    if (msg === null || isProcessing) return;
    try {
      isProcessing = true;
      const content = msg.content.toString();
      const ack = () => {
        channel.ack(msg);
        isProcessing = false;
      };
      const nack = (requeue?: boolean) => {
        channel.nack(msg, requeue);
        isProcessing = false;
      };

      await callback(content, ack, nack);
    } catch (error) {
      console.error('Error processing message:', error);
      isProcessing = false;
      channel.nack(msg);
    }
  }, { noAck: false });
}