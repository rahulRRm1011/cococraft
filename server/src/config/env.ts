import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env
dotenv.config();

export interface AppConfig {
  port: number;
  strapiUrl: string;
  strapiApiToken: string;
  databasePath: string;
  nodeEnv: string;
}

export const config: AppConfig = {
  port: parseInt(process.env.PORT || '4000', 10),
  strapiUrl: process.env.STRAPI_URL || 'http://localhost:1337',
  strapiApiToken: process.env.STRAPI_API_TOKEN || '',
  databasePath: process.env.DATABASE_PATH || path.resolve(process.cwd(), 'data', 'cococraft.db'),
  nodeEnv: process.env.NODE_ENV || 'development'
};
