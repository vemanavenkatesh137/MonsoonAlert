import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Try loading env from root first, then local directory
const rootEnv = path.resolve(__dirname, '../../.env');
const localEnv = path.resolve(__dirname, '../.env');

if (fs.existsSync(rootEnv)) {
  dotenv.config({ path: rootEnv });
} else if (fs.existsSync(localEnv)) {
  dotenv.config({ path: localEnv });
} else {
  dotenv.config(); // Fallback to default behavior
}

export const config = {
  port: parseInt(process.env.PORT || '3051', 10),
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  openweatherApiKey: process.env.OPENWEATHER_API_KEY || '',
  databaseUrl: process.env.DATABASE_URL || '',
};

// Check for required environment keys and log warnings if missing
export function checkRequiredEnv() {
  const missing: string[] = [];
  if (!config.openaiApiKey) missing.push('OPENAI_API_KEY');
  if (!config.openweatherApiKey) missing.push('OPENWEATHER_API_KEY');

  if (missing.length > 0) {
    console.warn(`[WARNING] Missing critical API keys in environment: ${missing.join(', ')}`);
    console.warn(`Please create a .env file containing these keys for full live functionality.`);
  }

  if (!config.databaseUrl) {
    console.info(`[INFO] DATABASE_URL is not set. The vector store will fall back to an in-memory cosine-similarity implementation.`);
  }
}
