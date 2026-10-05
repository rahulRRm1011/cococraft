import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import apiRoutes from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';

const app: Application = express();

// Global Middleware
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4000',
  'http://127.0.0.1:4000',
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, server-to-server, or same-origin)
      if (!origin) return callback(null, true);

      // Allow local development
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // Allow Vercel preview and production deployments
      try {
        const originUrl = new URL(origin);
        if (
          originUrl.hostname === 'cococraft.vercel.app' ||
          originUrl.hostname.endsWith('.vercel.app')
        ) {
          return callback(null, true);
        }
      } catch {
        // invalid URL format
      }

      // Allow explicit APP_URL or VERCEL_URL if set
      if (process.env.APP_URL && origin === process.env.APP_URL) {
        return callback(null, true);
      }

      // Reject untrusted cross-origin requests
      callback(new Error('Cross-Origin Request Blocked by CocoCraft CORS policy.'));
    },
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Mount API routes under /api and / to handle both direct and rewritten requests
app.use('/api', apiRoutes);
app.use('/', apiRoutes);

// Fallback for unmatched routes
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Resource not found',
  });
});

// Centralized error handling middleware
app.use(errorHandler);

export default app;
