const ApiResponse = require('../utils/apiResponse');

function validate(schema, target = 'body') {
  return (req, res, next) => {
    try {
      const dataToValidate = req[target];
      const parsed = schema.safeParse(dataToValidate);

      if (!parsed.success) {
        const issues = (parsed.error && (parsed.error.issues || parsed.error.errors)) || [];
        const errorDetails = Array.isArray(issues) ? issues.map((err) => ({
          field: Array.isArray(err.path) ? err.path.join('.') : String(err.path || ''),
          issue: err.message,
          rule: err.code
        })) : [];

        return ApiResponse.error(
          res,
          'Input validation failed (Syntactic Gatekeeper)',
          400,
          'VALIDATION_ERROR',
          errorDetails
        );
      }

      req[target] = parsed.data;
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = validate;
