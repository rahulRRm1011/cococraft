import app from './app.js';
import { config } from './config/env.js';

const server = app.listen(config.port, () => {
  console.log(`[CocoCraft Server] Express API running on http://localhost:${config.port}`);
  console.log(`[CocoCraft Server] Health check available at http://localhost:${config.port}/api/health`);
  console.log(`[CocoCraft Server] Connected to Supabase PostgreSQL at ${config.supabaseUrl}`);
});

// Graceful shutdown
const shutdown = () => {
  console.log('\n[CocoCraft Server] Shutting down gracefully...');
  server.close(() => {
    console.log('[CocoCraft Server] Closed.');
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
