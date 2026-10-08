const { z } = require('zod');

const createCustomerSchema = z.object({
  customerCode: z.string().min(3).max(20),
  name: z.string().min(2).max(100),
  email: z.string().email(),
  phone: z.string().optional().nullable(),
  loyaltyTier: z.enum(['BRONZE', 'SILVER', 'GOLD', 'PLATINUM']).default('BRONZE')
});

const createOrderSchema = z.object({
  orderNumber: z.string().min(3).max(30),
  customerId: z.number().int().positive(),
  totalAmount: z.number().min(0.0, 'Total amount must be >= 0.00'),
  status: z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'CANCELLED', 'REFUNDED']).default('PENDING'),
  shippingAddress: z.string().min(5).max(255)
});

module.exports = {
  createCustomerSchema,
  createOrderSchema
};
