const crypto = require('crypto');
const bcrypt = require('bcryptjs');

function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

function comparePassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

function generateMockEncryption(text) {
  const salt = crypto.randomBytes(8).toString('hex');
  const cipher = crypto.createCipheriv('aes-256-cbc', crypto.scryptSync('master-key', 'salt', 32), Buffer.alloc(16, 0));
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `enc_aes256_cbc$${salt}:${encrypted}`;
}

function maskSecret(text, visibleChars = 4) {
  if (!text) return '';
  if (text.length <= visibleChars) return '***';
  return text.substring(0, visibleChars) + '•'.repeat(Math.min(24, text.length - visibleChars));
}

module.exports = {
  hashPassword,
  comparePassword,
  generateMockEncryption,
  maskSecret
};
