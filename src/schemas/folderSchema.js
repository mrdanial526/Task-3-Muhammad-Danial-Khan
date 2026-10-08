const { z } = require('zod');

const createFolderSchema = z.object({
  userId: z.number().int().positive('User ID must be a positive integer'),
  name: z.string().min(2).max(60),
  description: z.string().max(255).optional().nullable(),
  colorCode: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color (e.g. #3B82F6)').default('#3B82F6'),
  icon: z.string().default('folder-key'),
  isLocked: z.number().int().min(0).max(1).default(0)
});

const updateFolderSchema = z.object({
  name: z.string().min(2).max(60).optional(),
  description: z.string().max(255).optional().nullable(),
  colorCode: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  icon: z.string().optional(),
  isLocked: z.number().int().min(0).max(1).optional()
});

module.exports = {
  createFolderSchema,
  updateFolderSchema
};
