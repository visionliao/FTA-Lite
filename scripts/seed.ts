// scripts/seed.ts
import dotenv from 'dotenv';
import path from 'path';
// --- 在所有其他 import 之前加载 .env 文件 ---
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
import { getDbInstance } from '../lib/db';

async function runSeeding() {
  console.log('Starting knowledge base seeding process...');
  try {
    const db = await getDbInstance();
    const knowledgePath = path.join(process.cwd(), 'template', 'knowledge');
    await db.seed(knowledgePath); // 只调用 seed 方法
    console.log('Seeding process completed successfully!');
  } catch (error) {
    console.error('Seeding process failed:', error);
    process.exit(1);
  }
}

runSeeding();