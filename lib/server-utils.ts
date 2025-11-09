// lib/server-utils.ts
// This file contains utilities that should only be used on the server side

import { appendFile, writeFile } from 'fs/promises'

export async function appendToLogFile(filePath: string, content: string): Promise<void> {
  try {
    await appendFile(filePath, content, 'utf-8');
  } catch (error) {
    console.error(`Failed to append to log file ${filePath}:`, error);
    throw error;
  }
}

export async function ensureLogFileExists(filePath: string): Promise<void> {
  try {
    await writeFile(filePath, '', { flag: 'wx' });
  } catch (error: unknown) {
    if (error instanceof Error && (error as any).code !== 'EEXIST') {
      console.error(`Failed to create log file ${filePath}:`, error);
      throw error;
    } else if (typeof error === 'object' && error !== null && 'code' in error) {
      if ((error as { code: string }).code !== 'EEXIST') {
        console.error(`Failed to create log file ${filePath}:`, error);
        throw error;
      }
    } else {
      console.error(`Failed to create log file ${filePath}:`, error);
      throw error;
    }
  }
}