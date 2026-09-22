import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import apiRoutes from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';

const app: Application = express();

// Global Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Mount API routes under /api
app.use('/api', apiRoutes);

// Fallback for unmatched routes
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Resource not found'
  });
});

// Centralized error handling middleware
app.use(errorHandler);

export default app;
