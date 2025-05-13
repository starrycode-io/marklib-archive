import Fastify from 'fastify'
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs-extra'
import path from 'path'
import { uploadFile } from "../s3/operations";

const execAsync = promisify(exec)

const fastify = Fastify({
  logger: true
}).withTypeProvider<TypeBoxTypeProvider>()

export async function generateHTML(id:string, url: string): Promise<void> {
  try {
    const tempDir = path.join(__dirname, '../temp')
    await fs.ensureDir(tempDir)

    // Generate a unique filename
    const filename = id + '.html'
    const outputPath = path.join(__dirname, '../temp', filename)

    // Execute single-file-cli
    await execAsync(`single-file --browser-executable-path=/usr/bin/chromium --browser-arg="--user-data-dir=./chromium-profile" --browser-arg="--no-sandbox" --browser-arg="--headless" --browser-arg="--load-extension=./uBOLite.chromium.mv3" --browser-load-max-time=300000 --browser-capture-max-time=300000 --user-agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36" "${url}" "${outputPath}"`)

    // Read the generated file
    const fileContent = await fs.promises.readFile(outputPath)

    // Upload to S3 using the provided function
    const bucket = process.env.S3_BUCKET_NAME || 'your-bucket-name'
    await uploadFile(fileContent, bucket, filename)

    // Delete the temporary file
    await fs.promises.unlink(outputPath)

    fastify.log.info(`Processed ${url} and uploaded to S3.`)
  } catch (error) {
    if (error instanceof Error && 'stdout' in error) {
      fastify.log.error(`Command output: ${error.stdout}`);
    } else {
      fastify.log.error(`Error processing ${url}: ${error}`);
    }
    throw error;
  }
}