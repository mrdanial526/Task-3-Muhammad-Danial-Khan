const express = require('express');
const path = require('path');
const cors = require('cors');
const env = require('./config/env');
const requestLogger = require('./middleware/requestLogger');
const rateLimiter = require('./middleware/rateLimiter');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const routes = require('./routes');
const ApiResponse = require('./utils/apiResponse');

function createApp() {
  const app = express();

  // Basic Security & Parsing Middleware
  app.use(cors());
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Custom Tracing and Rate Limiting
  app.use(requestLogger);
  app.use(rateLimiter);

  // Serve static interactive UI dashboard
  app.use(express.static(path.join(__dirname, 'public')));

  // Root redirect/status
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

  // API Documentation Overview endpoint
  app.get('/api', (req, res) => {
    return ApiResponse.success(res, {
      name: 'The Persistent Vault API',
      version: '1.0.0',
      pillars: [
        'Pillar 1: Relational Blueprint (1:1, 1:Many, M:M Geometry)',
        'Pillar 2: Native Bridge (SQLite with WAL & Prepared Statements)',
        'Pillar 3: CRUD & RESTful HTTP Actions',
        'Pillar 4: The Shield (DB Constraints & SQLi Immunity)'
      ],
      endpoints: {
        users: `${env.API_PREFIX}/users`,
        items: `${env.API_PREFIX}/items`,
        folders: `${env.API_PREFIX}/folders`,
        tags: `${env.API_PREFIX}/tags`,
        academics: `${env.API_PREFIX}/academics`,
        commerce: `${env.API_PREFIX}/commerce`,
        securitySandbox: `${env.API_PREFIX}/security/injection-sandbox`,
        systemHealth: `${env.API_PREFIX}/system/health`,
        databaseIntegrity: `${env.API_PREFIX}/system/integrity`,
        databaseMetrics: `${env.API_PREFIX}/system/metrics`
      }
    }, 'DecodeLabs Project 3: The Persistent Vault API');
  });

  // Mount API Routes
  app.use(env.API_PREFIX, routes);

  // 404 and Centralized Error Handling
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
