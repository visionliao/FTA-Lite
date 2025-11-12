// lib/db/pg/client.ts
import { Pool } from 'pg';

if (!process.env.POSTGRES_URL) {
  throw new Error("POSTGRES_URL is not defined in environment variables.");
}

declare global {
  var pgPool: Pool | undefined;
}

// 创建或复用一个标准的 Pool
const pool = global.pgPool || new Pool({
  connectionString: process.env.POSTGRES_URL,
  max: 50,
  idleTimeoutMillis: 60000,
  connectionTimeoutMillis: 10000,
});

if (process.env.NODE_ENV !== 'production') {
  global.pgPool = pool;
}

// 直接导出这个 pool 实例
export default pool;