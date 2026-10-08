const { z } = require('zod');

const createTagSchema = z.object({
  name: z.string().min(2).max(30).regex(/^[a-zA-Z0-9_-]+$/, 'Tag name must be alphanumeric with underscores/hyphens'),
  colorHex: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a 7-character hex code starting with # (e.g. #10B981)').default('#10B981')
});

module.exports = {
  createTagSchema
};
