const { z } = require('zod');

const createItemSchema = z.object({
  userId: z.number().int().positive('User ID must be a positive integer'),
  folderId: z.number().int().positive().optional().nullable(),
  title: z.string().min(3).max(120),
  secretType: z.enum(['LOGIN', 'SECURE_NOTE', 'CREDIT_CARD', 'API_KEY', 'DOCUMENT']).default('SECURE_NOTE'),
  payload: z.string().min(1, 'Secret payload cannot be empty'),
  sensitivityScore: z.number().int().min(1).max(100).default(50),
  expiresAt: z.string().regex(/^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}:\d{2})?$/, 'Date format must be YYYY-MM-DD or YYYY-MM-DD HH:MM:SS').optional().nullable(),
  tagIds: z.array(z.number().int().positive()).optional().default([])
});

const updateItemSchema = z.object({
  folderId: z.number().int().positive().optional().nullable(),
  title: z.string().min(3).max(120).optional(),
  secretType: z.enum(['LOGIN', 'SECURE_NOTE', 'CREDIT_CARD', 'API_KEY', 'DOCUMENT']).optional(),
  payload: z.string().min(1).optional(),
  sensitivityScore: z.number().int().min(1).max(100).optional(),
  expiresAt: z.string().regex(/^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}:\d{2})?$/).optional().nullable(),
  tagIds: z.array(z.number().int().positive()).optional()
});

module.exports = {
  createItemSchema,
  updateItemSchema
};
