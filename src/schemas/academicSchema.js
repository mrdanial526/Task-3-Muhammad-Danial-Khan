const { z } = require('zod');

const createStudentSchema = z.object({
  studentCode: z.string().min(3).max(20),
  fullName: z.string().min(2).max(100),
  email: z.string().email(),
  enrollmentYear: z.number().int().min(2000).max(2100),
  gpa: z.number().min(0.0).max(4.0).default(3.00)
});

const createCourseSchema = z.object({
  courseCode: z.string().min(3).max(20),
  title: z.string().min(3).max(120),
  credits: z.number().int().min(1).max(6),
  department: z.string().min(2).max(60)
});

const enrollSchema = z.object({
  studentId: z.number().int().positive(),
  courseId: z.number().int().positive(),
  grade: z.enum(['A', 'B', 'C', 'D', 'F', 'IN_PROGRESS']).default('IN_PROGRESS')
});

module.exports = {
  createStudentSchema,
  createCourseSchema,
  enrollSchema
};
