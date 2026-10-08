const env = require('./src/config/env');
const { createApp } = require('./src/server');
const { runMigrations } = require('./src/database/migrate');
const { close } = require('./src/database/db');
const logger = require('./src/utils/logger');

// Run migrations on startup to guarantee tables and schema constraints are active
try {
  runMigrations();
} catch (err) {
  logger.error('Failed to run database migrations:', err.message);
  process.exit(1);
}

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.success('================================================================');
  logger.success(`🚀 DecodeLabs Project 3: The Persistent Vault API is LIVE!`);
  logger.success(`🌐 Server running at: http://localhost:${env.PORT}`);
  logger.success(`📊 Interactive Cockpit UI: http://localhost:${env.PORT}/`);
  logger.success(`🛡️ REST API Root: http://localhost:${env.PORT}${env.API_PREFIX}`);
  logger.success(`🔒 Database Storage: ${env.DATABASE_ABSOLUTE_PATH}`);
  logger.success('================================================================');
});

// Graceful Shutdown
function handleShutdown(signal) {
  logger.info(`Received ${signal}. Gracefully closing HTTP server and database...`);
  server.close(() => {
    close();
    logger.success('Server and SQLite database cleanly closed.');
    process.exit(0);
  });
}

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

module.exports = { app, server };
