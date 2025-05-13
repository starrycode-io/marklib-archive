// rabbitmq-connection.ts
import * as amqp from 'amqplib';

class MQConnection {
  private static instance: MQConnection;
  private connection: amqp.Connection | null = null;
  private channel: amqp.Channel | null = null;

  private constructor() {
  }

  public static getInstance(): MQConnection {
    if (!MQConnection.instance) {
      MQConnection.instance = new MQConnection();
    }
    return MQConnection.instance;
  }

  public async connect(): Promise<void> {
    try {
      const username = process.env.QUEUE_USERNAME || 'guest';
      const password = process.env.QUEUE_PASSWORD || 'guest';
      const host = process.env.QUEUE_HOST || 'localhost:5672';

      const connectionString = `amqp://${username}:${password}@${host}`;
      const connectionOptions = {
        frameMax: 0,
        heartbeat: 60
      };
      
      this.connection = await amqp.connect(connectionString, connectionOptions);
      console.log('Connected to RabbitMQ');

      this.channel = await this.connection.createChannel();
      console.log('Channel created');
    } catch (error) {
      console.error('Error connecting to RabbitMQ:', error);
      throw error;
    }
  }

  public getChannel(): amqp.Channel {
    if (!this.channel) {
      throw new Error('Channel not created. Call connect() first.');
    }
    return this.channel;
  }

  public async closeConnection(): Promise<void> {
    try {
      if (this.channel) {
        await this.channel.close();
      }
      if (this.connection) {
        await this.connection.close();
      }
      console.log('Disconnected from RabbitMQ');
    } catch (error) {
      console.error('Error closing RabbitMQ connection:', error);
      throw error;
    }
  }
}

export default MQConnection;