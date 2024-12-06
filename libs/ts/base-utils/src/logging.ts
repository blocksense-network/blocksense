import * as fs from 'fs/promises';

export const logToFile = async (
  logFile: string,
  message: string,
): Promise<void> => {
  try {
    await fs.appendFile(logFile, message + '\n', { flag: 'a' });
  } catch (error) {
    console.error(`Error writing to log file ${logFile}:`, error);
  }
};
