// rabbitmq-connection.ts
import * as amqp from 'amqplib';

class MQConnection {
  private static instance: MQConnection;
  private connection: amqp.Connection | null = null;
  private channel: amqp.Channel | null = null;
  private connecting: boolean = false;
  private connectionRetryCount: number = 0;
  private readonly maxRetries: number = 5;
  private readonly initialRetryDelay: number = 1000; // 1秒

  private constructor() {
  }

  public static getInstance(): MQConnection {
    if (!MQConnection.instance) {
      MQConnection.instance = new MQConnection();
    }
    return MQConnection.instance;
  }

  private async waitForRetry(attempt: number): Promise<void> {
    // 使用指数退避策略，每次重试延迟时间翻倍
    const delay = this.initialRetryDelay * Math.pow(2, attempt);
    console.log(`等待 ${delay}ms 后进行第 ${attempt + 1} 次重试...`);
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  public async connect(): Promise<void> {
    // 如果已经在连接中，等待连接完成
    if (this.connecting) {
      console.log('已经有一个连接进程在进行中...');
      return;
    }

    this.connecting = true;

    try {
      while (this.connectionRetryCount < this.maxRetries) {
        try {
          const username = process.env.QUEUE_USERNAME || 'guest';
          const password = process.env.QUEUE_PASSWORD || 'guest';
          const host = process.env.QUEUE_HOST || 'localhost:5672';

          const connectionString = `amqp://${username}:${password}@${host}`;
          
          // 添加连接选项
          const connectionOptions = {
            heartbeat: 60,            // 心跳检测间隔
            timeout: 10000,           // 连接超时时间
            connectionRetryCount: 0,   // amqplib 内部重试次数
          };

          console.log(`尝试连接到 RabbitMQ (第 ${this.connectionRetryCount + 1} 次尝试)`);
          this.connection = await amqp.connect(connectionString, connectionOptions);
          
          // 设置连接错误处理
          this.connection.on('error', (err) => {
            console.error('RabbitMQ 连接错误:', err);
            this.handleConnectionError();
          });

          this.connection.on('close', () => {
            console.error('RabbitMQ 连接关闭');
            this.handleConnectionError();
          });

          this.channel = await this.connection.createChannel();
          
          // 设置通道错误处理
          this.channel.on('error', (err) => {
            console.error('RabbitMQ 通道错误:', err);
            this.handleChannelError();
          });

          this.channel.on('close', () => {
            console.error('RabbitMQ 通道关闭');
            this.handleChannelError();
          });

          console.log('成功连接到 RabbitMQ');
          this.connectionRetryCount = 0; // 重置重试计数
          this.connecting = false;
          return;

        } catch (error) {
          console.error(`连接尝试 ${this.connectionRetryCount + 1} 失败:`, error);
          
          if (this.connectionRetryCount < this.maxRetries - 1) {
            await this.waitForRetry(this.connectionRetryCount);
            this.connectionRetryCount++;
          } else {
            throw new Error(`在 ${this.maxRetries} 次尝试后无法连接到 RabbitMQ`);
          }
        }
      }
    } finally {
      this.connecting = false;
    }
  }

  private async handleConnectionError(): Promise<void> {
    this.channel = null;
    this.connection = null;
    // 触发重新连接
    await this.connect();
  }

  private async handleChannelError(): Promise<void> {
    this.channel = null;
    if (this.connection) {
      try {
        this.channel = await this.connection.createChannel();
      } catch (error) {
        console.error('重新创建通道失败:', error);
        await this.handleConnectionError();
      }
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