import { FastifyPluginAsync } from 'fastify';
import MQConnection from "../mq/connect";
import { consumeMessages } from "../mq/operations";
import { generateHTML } from "../application/archive";

interface BookmarkMessage {
  id: string;
  url: string;
}

const mqPlugin: FastifyPluginAsync = async (fastify, opts) => {
  try {
    const connection = MQConnection.getInstance();
    await connection.connect();

    const queueName = 'bookmark_archive';
    const deadLetterQueueName = queueName + '_dlq';
    const deadLetterExchange = queueName + '_dlx';
    
    // Declare the dead letter exchange
    await connection.getChannel().assertExchange(deadLetterExchange, 'direct');

    // Declare the dead letter queue
    await connection.getChannel().assertQueue(deadLetterQueueName);

    // Bind the dead letter queue to the dead letter exchange
    await connection.getChannel().bindQueue(deadLetterQueueName, deadLetterExchange, '');

    // Declare the main queue, and configure the dead letter exchange
    await connection.getChannel().assertQueue(queueName, {
      arguments: {
        'x-dead-letter-exchange': deadLetterExchange,
        'x-dead-letter-routing-key': ''
      }
    });
    
    await consumeMessages(queueName, async (message, ack, nack) => {
      const msg: BookmarkMessage = JSON.parse(message);
      fastify.log.info(`Received message: ${message}`);

      try {
        // 15 Minutes Timeout
        const timeoutMs = 15 * 60 * 1000;
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Operation timed out')), timeoutMs);
        });

        await Promise.race([
          generateHTML(msg.id, msg.url),
          timeoutPromise
        ]);
        
        ack();
      } catch (error) {
        fastify.log.error(`Error processing message: ${error}`);
        nack(false);
      }
    });

  } catch (error) {
    console.error('Error:', error);
  }
};

export default mqPlugin;