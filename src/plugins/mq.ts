import { FastifyPluginAsync } from 'fastify';
import MQConnection from "../mq/connect";
import { consumeMessages } from "../mq/operations";

const mqPlugin: FastifyPluginAsync = async (fastify, opts) => {
  try {
    const connection = MQConnection.getInstance();
    await connection.connect();

    const queueName = 'bookmark-archive';
    await consumeMessages(queueName, (message) => {
      console.log(`Received message: ${message}`);
    });

  } catch (error) {
    console.error('Error:', error);
  }
};

export default mqPlugin;