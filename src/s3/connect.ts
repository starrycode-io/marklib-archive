import { S3Client, S3ClientConfig } from "@aws-sdk/client-s3";

class OSSConnection {
  private static instance: OSSConnection;
  private client: S3Client | null = null;

  private constructor() {
  }

  public static getInstance(): OSSConnection {
    if (!OSSConnection.instance) {
      OSSConnection.instance = new OSSConnection();
    }
    return OSSConnection.instance;
  }

  public getClient(): S3Client {
    if (!this.client) {
      throw new Error('S3Client not initialized. Call connect() first.');
    }
    return this.client;
  }

  public async connect(): Promise<void> {
    try {
      const region = process.env.S3_REGION || 'your-region';
      const endpoint = process.env.S3_ENDPOINT || 'https://your-custom-endpoint.com';
      const accessKeyId = process.env.S3_ACCESS_KEY_ID || 'your-access-key-id';
      const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY || 'your-secret-access-key';

      const config: S3ClientConfig = {
        region: region,
        endpoint: endpoint,
        credentials: {
          accessKeyId: accessKeyId,
          secretAccessKey: secretAccessKey
        },
      };
      this.client = new S3Client(config);
      console.log('Connected to S3');
    } catch (error) {
      console.error('Error connecting to S3:', error);
      throw error;
    }
  }
}

export default OSSConnection;