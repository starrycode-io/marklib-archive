import Fastify from 'fastify'
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import path from 'path'
import { uploadFile } from "../s3/operations";

const execAsync = promisify(exec)

const fastify = Fastify({
  logger: true
}).withTypeProvider<TypeBoxTypeProvider>()

export async function generateHTML(url: string): Promise<void> {
  try {
    // Generate a unique filename
    const filename = `${Date.now()}-${Math.random().toString(36).substring(7)}.html`
    const outputPath = path.join(__dirname, '../temp', filename)

    // Execute single-file-cli
    await execAsync(`single-file ${url} --output-file="${outputPath}"`)

    // Read the generated file
    const fileContent = await fs.promises.readFile(outputPath)

    // Upload to S3 using the provided function
    const bucket = process.env.S3_BUCKET_NAME || 'your-bucket-name'
    const s3Url = await uploadFile(fileContent, bucket, filename)

    // Delete the temporary file
    await fs.promises.unlink(outputPath)

    fastify.log.info(`Processed ${url} and uploaded to S3. URL: ${s3Url}`)
  } catch (error) {
    fastify.log.error(`Error processing ${url}: ${error}`)
  }
}