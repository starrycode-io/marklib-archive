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
    
    await consumeMessages(queueName, async (message, ack, nack, headers) => {
      const msg: BookmarkMessage = JSON.parse(message);
      const retryCount = (headers?.['x-retry-count'] as number) || 0;
      const maxRetries = 3;

      fastify.log.info(`Processing message: ${message}, retry count: ${retryCount}`);

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
        
        if (retryCount < maxRetries) {
          try {
            const channel = connection.getChannel();
            const delay = Math.pow(2, retryCount) * 1000;
            
            channel.sendToQueue(queueName, Buffer.from(message), {
              headers: {
                'x-retry-count': retryCount + 1,
                'x-error': error
              },
              expiration: delay.toString()
            });
            
            fastify.log.info(`Message requeued with delay: ${delay}ms`);
            ack();
          } catch (publishError) {
            fastify.log.error(`Failed to publish retry message: ${publishError}`);
            nack(false);
          }
        } else {
          fastify.log.error(`Message failed after ${maxRetries} retries, moving to DLQ. Final error: ${error}`);
          nack(false);
        }
      }
    });

  } catch (error) {
    console.error('Error:', error);
  }
};

export default mqPlugin;