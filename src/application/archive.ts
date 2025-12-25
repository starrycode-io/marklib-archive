import Fastify from 'fastify'
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import { exec, ChildProcess } from 'child_process'
import fs from 'fs-extra'
import path from 'path'
import { uploadFile } from "../s3/operations";
import { sendMessage } from "../mq/operations";

class BookmarkMessage {
  id: string;

  constructor(id:string) {
        this.id = id
  }
}

const fastify = Fastify({
  logger: true
}).withTypeProvider<TypeBoxTypeProvider>()

interface GenerateHTMLOptions {
  timeout?: number;
}

export async function generateHTML(id:string, url: string, options?: GenerateHTMLOptions): Promise<void> {
  const timeout = options?.timeout || 15 * 60 * 1000; // Default 15 minutes
  let childProcess: ChildProcess | null = null;
  let profileDir: string | null = null;
  let timeoutHandle: NodeJS.Timeout | null = null;
  let outputPath: string | null = null;
  let outputFileDeleted = false;

  try {
    const tempDir = path.join(__dirname, '../temp')
    await fs.ensureDir(tempDir)

    // Generate a unique filename
    const filename = id + '.html'
    outputPath = path.join(__dirname, '../temp', filename)

    // Create unique chromium profile directory for this task
    profileDir = path.join(__dirname, '../temp', `chromium-profile-${id}`)
    await fs.ensureDir(profileDir)

    // Execute single-file-cli with unique profile directory
    const command = `single-file --browser-executable-path=/usr/bin/chromium --browser-arg="--user-data-dir=${profileDir}" --browser-arg="--no-sandbox" --browser-arg="--headless" --browser-arg="--load-extension=./uBOLite.chromium.mv3" --browser-load-max-time=300000 --browser-capture-max-time=300000 --user-agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36" "${url}" "${outputPath}"`;

    await new Promise<void>((resolve, reject) => {
      // Use detached: true to create a new process group, allowing us to kill all child processes
      childProcess = exec(command, { detached: true }, (error, stdout, stderr) => {
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
          timeoutHandle = null;
        }

        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });

      // Set up timeout that will kill the process
      timeoutHandle = setTimeout(() => {
        if (childProcess && !childProcess.killed) {
          fastify.log.warn(`Timeout reached for ${url}, killing process (PID: ${childProcess.pid})...`);

          // Kill the entire process group (works on Unix-like systems)
          try {
            if (childProcess.pid) {
              // Negative PID kills the process group
              process.kill(-childProcess.pid, 'SIGKILL');
              fastify.log.info(`Killed process group: -${childProcess.pid}`);
            }
          } catch (killError) {
            // Fallback: if process group kill fails (e.g., on Windows or if process isn't detached)
            fastify.log.warn(`Failed to kill process group, trying individual process: ${killError}`);
            try {
              childProcess.kill('SIGKILL');
              fastify.log.info(`Killed individual process: ${childProcess.pid}`);
            } catch (fallbackError) {
              fastify.log.error(`Failed to kill process: ${fallbackError}`);
            }
          }

          reject(new Error(`Process killed due to timeout for URL: ${url}`));
        }
      }, timeout);
    })
    
    let stats;
    try {
      stats = await fs.promises.stat(outputPath);
    } catch (statError) {
      fastify.log.error(`HTML file was not found at ${outputPath} after generation attempt for URL: ${url}. Error: ${statError instanceof Error ? statError.message : String(statError)}`);
      throw new Error(`HTML file generation failed for URL: ${url}. File not found at ${outputPath}.`);
    }

    if (!stats.isFile()) {
      fastify.log.error(`Path ${outputPath} exists but is not a file after generation attempt for URL: ${url}.`);
      throw new Error(`HTML file generation failed for URL: ${url}. Path is not a file.`);
    }

    if (stats.size === 0) {
      fastify.log.error(`HTML file generated at ${outputPath} is empty for URL: ${url}.`);
      throw new Error(`HTML file generation failed for URL: ${url}. Generated file is empty.`);
    }

    // Read the generated file
    const fileContent = await fs.promises.readFile(outputPath)

    // Upload to S3 using the provided function
    const bucket = process.env.S3_BUCKET_NAME || 'your-bucket-name'
    await uploadFile(fileContent, bucket, filename)

    // Delete the temporary file immediately after successful upload
    await fs.promises.unlink(outputPath)
    outputFileDeleted = true

    // Send archive done to MQ
    var msg = new BookmarkMessage(id)
    await sendMessage("bookmark_archive_done", JSON.stringify(msg))

    fastify.log.info(`Processed ${url} and uploaded to S3.`)
  } catch (error) {
    if (error instanceof Error && 'stdout' in error) {
      fastify.log.error(`Command output: ${error.stdout}`);
    } else {
      fastify.log.error(`Error processing ${url}: ${error}`);
    }
    throw error;
  } finally {
    // Clean up resources regardless of success or failure
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }

    // Kill any remaining child process
    if (childProcess && !childProcess.killed) {
      try {
        fastify.log.warn(`Cleaning up child process (PID: ${childProcess.pid})...`);
        if (childProcess.pid) {
          // Try to kill process group first
          try {
            process.kill(-childProcess.pid, 'SIGKILL');
            fastify.log.debug(`Killed process group in cleanup: -${childProcess.pid}`);
          } catch (groupKillError) {
            // Fallback to killing individual process
            try {
              childProcess.kill('SIGKILL');
              fastify.log.debug(`Killed individual process in cleanup: ${childProcess.pid}`);
            } catch (processKillError) {
              fastify.log.error(`Failed to kill process in cleanup: ${processKillError}`);
            }
          }
        }
      } catch (killError) {
        fastify.log.error(`Error in process cleanup: ${killError}`);
      }
    }

    // Clean up temporary HTML file if it wasn't already deleted
    if (outputPath && !outputFileDeleted) {
      try {
        if (await fs.pathExists(outputPath)) {
          await fs.unlink(outputPath);
          fastify.log.debug(`Cleaned up temporary file: ${outputPath}`);
        }
      } catch (cleanupError) {
        fastify.log.error(`Error cleaning up temporary file ${outputPath}: ${cleanupError}`);
      }
    }

    // Clean up chromium profile directory
    if (profileDir) {
      try {
        await fs.remove(profileDir);
        fastify.log.debug(`Cleaned up profile directory: ${profileDir}`);
      } catch (cleanupError) {
        fastify.log.error(`Error cleaning up profile directory ${profileDir}: ${cleanupError}`);
      }
    }
  }
}