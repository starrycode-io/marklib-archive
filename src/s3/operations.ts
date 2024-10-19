import OSSConnection from './connect';
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import Fastify from "fastify";
import { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";

const fastify = Fastify({
  logger: true
}).withTypeProvider<TypeBoxTypeProvider>()

export async function uploadFile(file: Buffer, bucket: string, key: string): Promise<string> {
  try {
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: file,
    });

    const connection = OSSConnection.getInstance();
    await connection.connect();
    const client = connection.getClient()
    await client.send(command);
    return `https://${bucket}.s3.amazonaws.com/${encodeURIComponent(key)}`;
  } catch (error) {
    fastify.log.error('Error uploading file to S3:', error);
    throw new Error(`Failed to upload file to S3: ${error.message}`);
  }
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