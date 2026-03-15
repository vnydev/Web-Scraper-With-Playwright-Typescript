import fs from 'fs';
import path from 'path';

const LOG_FILE = path.join(process.cwd(), 'errors.log');

export const logError = (message: string, error?: any) => {
    const timestamp = new Date().toISOString();
    const errorDetails = error ? (error.stack || JSON.stringify(error)) : '';
    const logEntry = `[${timestamp}] ERROR: ${message}\n${errorDetails}\n${'-'.repeat(50)}\n`;

    fs.appendFileSync(LOG_FILE, logEntry);
    console.error(message, error);
};
