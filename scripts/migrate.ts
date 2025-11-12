// scripts/migrate.ts
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
import { getDbInstance } from '../lib/db';

async function runMigration() {
  console.log('Starting database migration process...');
  try {
    const db = await getDbInstance();
    await db.migrate(); // 只调用 migrate 方法
  } catch (error) {
    console.error('Migration process failed:', error);
    process.exit(1);
  }
}

runMigration();