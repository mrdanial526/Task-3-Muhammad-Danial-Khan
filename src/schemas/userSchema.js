const { z } = require('zod');

const createUserSchema = z.object({
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_-]+$/, 'Username must be alphanumeric with underscores or hyphens'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['ADMIN', 'OFFICER', 'AUDITOR', 'OPERATOR']).default('OPERATOR'),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'PENDING']).default('ACTIVE'),
  profile: z.object({
    fullName: z.string().min(2).max(100),
    avatarUrl: z.string().url().optional().nullable(),
    bio: z.string().max(500).optional().nullable(),
    clearanceLevel: z.number().int().min(1).max(5).default(1),
    phoneNumber: z.string().optional().nullable(),
    emergencyCode: z.string().optional().nullable()
  })
});

const updateUserSchema = z.object({
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_-]+$/).optional(),
  email: z.string().email().optional(),
  role: z.enum(['ADMIN', 'OFFICER', 'AUDITOR', 'OPERATOR']).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'PENDING']).optional(),
  profile: z.object({
    fullName: z.string().min(2).max(100).optional(),
    avatarUrl: z.string().url().optional().nullable(),
    bio: z.string().max(500).optional().nullable(),
    clearanceLevel: z.number().int().min(1).max(5).optional(),
    phoneNumber: z.string().optional().nullable(),
    emergencyCode: z.string().optional().nullable()
  }).optional()
});

const updateProfileSchema = z.object({
  fullName: z.string().min(2).max(100).optional(),
  avatarUrl: z.string().url().optional().nullable(),
  bio: z.string().max(500).optional().nullable(),
  clearanceLevel: z.number().int().min(1).max(5).optional(),
  phoneNumber: z.string().optional().nullable(),
  emergencyCode: z.string().optional().nullable()
});

module.exports = {
  createUserSchema,
  updateUserSchema,
  updateProfileSchema
};
