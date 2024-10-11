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

    const queueName = 'bookmark-archive';
    await consumeMessages(queueName, (message) => {
      const msg: BookmarkMessage = JSON.parse(message);
      console.log(`Received message: ${message}`);
      generateHTML(msg.url)
    });

  } catch (error) {
    console.error('Error:', error);
  }
};

export default mqPlugin;