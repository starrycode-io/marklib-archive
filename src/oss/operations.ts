import OSSConnection from './connect';
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";


export async function uploadFile(file: Buffer, bucket: string, key: string): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: file,
  });

  const connection = OSSConnection.getInstance();
  await connection.connect();
  await this.client.send(command);
  return `https://your-bucket-name.s3.amazonaws.com/${key}`;
}

export async function getSignedDownloadUrl(bucket: string, key: string): Promise<string> {
  const connection = OSSConnection.getInstance();
  const client = connection.getClient();
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  return getSignedUrl(client, command, {expiresIn: 3600});
}