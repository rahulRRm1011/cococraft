import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env (root and server folder)
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), 'server', '.env') });

export interface AppConfig {
  port: number;
  strapiUrl: string;
  strapiApiToken: string;
  databasePath: string;
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  nodeEnv: string;
  freeShippingThresholdPaise: number;
  standardShippingPaise: number;
}

export const config: AppConfig = {
  port: parseInt(process.env.PORT || '4000', 10),
  strapiUrl: process.env.STRAPI_URL || 'http://localhost:1337',
  strapiApiToken: process.env.STRAPI_API_TOKEN || '',
  databasePath: process.env.DATABASE_PATH || path.resolve(process.cwd(), 'data', 'cococraft.db'),
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseServiceRoleKey: (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
  nodeEnv: process.env.NODE_ENV || 'development',
  freeShippingThresholdPaise: parseInt(process.env.FREE_SHIPPING_THRESHOLD_PAISE || '150000', 10), // ₹1,500
  standardShippingPaise: parseInt(process.env.STANDARD_SHIPPING_PAISE || '9900', 10) // ₹99
};
