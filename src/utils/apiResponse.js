/**
 * Standardized API Response Envelopes
 */

class ApiResponse {
  static success(res, data, message = 'Operation successful', statusCode = 200, meta = {}) {
    return res.status(statusCode).json({
      success: true,
      statusCode,
      message,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        ...meta
      }
    });
  }

  static created(res, data, message = 'Resource created successfully', meta = {}) {
    return this.success(res, data, message, 201, meta);
  }

  static paginated(res, data, pagination = {}, message = 'Data retrieved successfully') {
    return res.status(200).json({
      success: true,
      statusCode: 200,
      message,
      data,
      pagination: {
        page: pagination.page || 1,
        limit: pagination.limit || data.length,
        total: pagination.total || data.length,
        totalPages: pagination.limit ? Math.ceil((pagination.total || data.length) / pagination.limit) : 1
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  }

  static error(res, message = 'An error occurred', statusCode = 500, errorCategory = 'INTERNAL_ERROR', details = null) {
    return res.status(statusCode).json({
      success: false,
      statusCode,
      errorCategory,
      message,
      details,
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  }
}

module.exports = ApiResponse;
