require('dotenv').config();
const path = require('path');
const { z } = require('zod');

const envSchema = z.object({
  PORT: z.string().default('3000').transform((val) => parseInt(val, 10)),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_PREFIX: z.string().default('/api/v1'),
  DATABASE_PATH: z.string().default('data/vault.db'),
  DB_ENABLE_WAL: z.string().default('true').transform((val) => val === 'true'),
  DB_FOREIGN_KEYS: z.string().default('true').transform((val) => val === 'true'),
  RATE_LIMIT_WINDOW_MS: z.string().default('60000').transform((val) => parseInt(val, 10)),
  RATE_LIMIT_MAX: z.string().default('120').transform((val) => parseInt(val, 10)),
  JWT_SECRET: z.string().default('persistent_vault_secret_key_decode_labs_2026'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info')
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Environment configuration error:', parsed.error.format());
  process.exit(1);
}

const env = parsed.data;

// Resolve absolute database path relative to project root
const dbAbsolutePath = path.isAbsolute(env.DATABASE_PATH)
  ? env.DATABASE_PATH
  : path.resolve(process.cwd(), env.DATABASE_PATH);

module.exports = {
  ...env,
  DATABASE_ABSOLUTE_PATH: dbAbsolutePath
};
