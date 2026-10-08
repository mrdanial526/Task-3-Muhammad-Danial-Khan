const db = require('../database/db');
const ApiResponse = require('../utils/apiResponse');

class CommerceController {
  /**
   * List customers with aggregated lifetime metrics (1:Many)
   * GET /api/v1/commerce/customers
   */
  static listCustomers(req, res, next) {
    try {
      const sql = `
        SELECT 
          c.id,
          c.customer_code AS customerCode,
          c.name,
          c.email,
          c.phone,
          c.loyalty_tier AS loyaltyTier,
          c.created_at AS createdAt,
          COUNT(o.id) AS totalOrders,
          COALESCE(SUM(o.total_amount), 0) AS totalSpent,
          MAX(o.created_at) AS latestOrderDate
        FROM customers c
        LEFT JOIN orders o ON c.id = o.customer_id
        GROUP BY c.id
        ORDER BY c.name ASC
      `;

      const customers = db.query(sql);
      return ApiResponse.success(res, customers, 'Customers retrieved with order summaries');
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get single customer with orders history (1:Many)
   * GET /api/v1/commerce/customers/:id
   */
  static getCustomerById(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return ApiResponse.error(res, 'Customer ID must be an integer', 400, 'INVALID_PARAMETER');
      }

      const customer = db.queryOne('SELECT * FROM customers WHERE id = ?', [id]);
      if (!customer) {
        return ApiResponse.error(res, `Customer with ID ${id} not found`, 404, 'CUSTOMER_NOT_FOUND');
      }

      // 1:Many joined orders
      const orders = db.query('SELECT * FROM orders WHERE customer_id = ? ORDER BY created_at DESC', [id]);
      customer.orders = orders;
      customer.totalOrders = orders.length;

      return ApiResponse.success(res, customer, 'Customer details retrieved');
    } catch (err) {
      next(err);
    }
  }

  /**
   * Create customer
   * POST /api/v1/commerce/customers
   */
  static createCustomer(req, res, next) {
    try {
      const { customerCode, name, email, phone, loyaltyTier } = req.body;
      const sql = `
        INSERT INTO customers (customer_code, name, email, phone, loyalty_tier, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `;
      const result = db.execute(sql, [customerCode, name, email, phone || null, loyaltyTier || 'BRONZE']);

      const created = db.queryOne('SELECT * FROM customers WHERE id = ?', [result.lastInsertRowid]);
      return ApiResponse.created(res, created, 'Customer account created');
    } catch (err) {
      next(err);
    }
  }

  /**
   * Create Order for customer (1:Many relationship)
   * POST /api/v1/commerce/orders
   */
  static createOrder(req, res, next) {
    try {
      const { orderNumber, customerId, totalAmount, status, shippingAddress } = req.body;

      const customer = db.queryOne('SELECT id, name FROM customers WHERE id = ?', [customerId]);
      if (!customer) {
        return ApiResponse.error(res, `Foreign Key Violation: Customer with ID ${customerId} does not exist`, 404, 'CUSTOMER_NOT_FOUND');
      }

      const sql = `
        INSERT INTO orders (order_number, customer_id, total_amount, status, shipping_address, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `;
      const result = db.execute(sql, [orderNumber, customerId, totalAmount, status || 'PENDING', shippingAddress]);

      const order = db.queryOne('SELECT * FROM orders WHERE id = ?', [result.lastInsertRowid]);
      return ApiResponse.created(res, order, `Order ${orderNumber} created for customer ${customer.name}`);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = CommerceController;
