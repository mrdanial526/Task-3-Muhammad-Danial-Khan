const env = require('../config/env');
const ApiResponse = require('../utils/apiResponse');

const requestCounts = new Map();

function rateLimiter(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress || '127.0.0.1';
  const now = Date.now();
  const windowMs = env.RATE_LIMIT_WINDOW_MS;
  const maxRequests = env.RATE_LIMIT_MAX;

  if (!requestCounts.has(ip)) {
    requestCounts.set(ip, []);
  }

  const timestamps = requestCounts.get(ip).filter((ts) => now - ts < windowMs);
  timestamps.push(now);
  requestCounts.set(ip, timestamps);

  res.setHeader('X-RateLimit-Limit', maxRequests);
  res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - timestamps.length));

  if (timestamps.length > maxRequests) {
    return ApiResponse.error(
      res,
      `Rate limit exceeded. Maximum ${maxRequests} requests per minute allowed.`,
      429,
      'RATE_LIMIT_EXCEEDED'
    );
  }

  next();
}

module.exports = rateLimiter;
