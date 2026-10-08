const env = require('../config/env');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

const logger = {
  info: (msg, ...args) => console.log(`${colors.cyan}[INFO]${colors.reset} ${msg}`, ...args),
  success: (msg, ...args) => console.log(`${colors.green}[SUCCESS]${colors.reset} ${msg}`, ...args),
  warn: (msg, ...args) => console.warn(`${colors.yellow}[WARN]${colors.reset} ${msg}`, ...args),
  error: (msg, ...args) => console.error(`${colors.red}[ERROR]${colors.reset} ${msg}`, ...args),
  sql: (query, params) => {
    if (env.LOG_LEVEL === 'debug') {
      console.log(`${colors.magenta}[SQL EXEC]${colors.reset} ${query} | Params:`, params || []);
    }
  }
};

module.exports = logger;
