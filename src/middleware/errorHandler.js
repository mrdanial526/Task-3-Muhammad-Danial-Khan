const ApiResponse = require('../utils/apiResponse');
const logger = require('../utils/logger');

function errorHandler(err, req, res, next) {
  logger.error(`[${req.id || 'NO-REQ-ID'}] Unhandled error:`, err.message);

  const statusCode = err.statusCode || 500;
  const errorCategory = err.errorCategory || 'INTERNAL_SERVER_ERROR';
  const details = err.details || (process.env.NODE_ENV === 'development' ? err.stack : undefined);

  return ApiResponse.error(res, err.message, statusCode, errorCategory, details);
}

function notFoundHandler(req, res) {
  return ApiResponse.error(
    res,
    `Route ${req.method} ${req.originalUrl} not found`,
    404,
    'RESOURCE_NOT_FOUND'
  );
}

module.exports = {
  errorHandler,
  notFoundHandler
};
