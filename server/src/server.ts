import app from './app.js';
import { config } from './config/env.js';
import { getDatabase, closeDatabase } from './database/index.js';

// Ensure the local SQLite database directory and connection are verified
try {
  const db = getDatabase();
  console.log(`[CocoCraft Server] SQLite Business DB connected at: ${config.databasePath}`);
} catch (err) {
  console.error('[CocoCraft Server] Failed to initialize SQLite Business DB:', err);
}

const server = app.listen(config.port, () => {
  console.log(`[CocoCraft Server] Express API running on http://localhost:${config.port}`);
  console.log(`[CocoCraft Server] Health check available at http://localhost:${config.port}/api/health`);
});

// Graceful shutdown
const shutdown = () => {
  console.log('\n[CocoCraft Server] Shutting down gracefully...');
  server.close(() => {
    closeDatabase();
    console.log('[CocoCraft Server] Database connection closed.');
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
