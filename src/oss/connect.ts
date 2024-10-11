import { S3Client } from "@aws-sdk/client-s3";

class OSSConnection {
  private static instance: OSSConnection;
  private client: S3Client;

  private constructor() {
  }

  public static getInstance(): OSSConnection {
    if (!OSSConnection.instance) {
      OSSConnection.instance = new OSSConnection();
    }
    return OSSConnection.instance;
  }

  public async getClient(): Promise<S3Client> {
    if (!this.client) {
      await this.connect();
    }
    return this.client;
  }

  public async connect(): Promise<void> {
    try {
      const region = process.env.OSS_REGION || 'your-region';
      const endpoint = process.env.OSS_ENDPOINT || 'https://your-custom-endpoint.com';
      const accessKeyId = process.env.OSS_ACCESS_KEY_ID || 'your-access-key-id';
      const secretAccessKey = process.env.OSS_SECRET_ACCESS_KEY || 'your-secret-access-key';

      this.client = new S3Client({
        region: region,
        endpoint: endpoint,
        credentials: {
          accessKeyId: accessKeyId,
          secretAccessKey: secretAccessKey
        },
      });
      console.log('Connected to OSS');
    } catch (error) {
      console.error('Error connecting to OSS:', error);
      throw error;
    }
  }
}

export default OSSConnection;