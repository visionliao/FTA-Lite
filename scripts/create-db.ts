// scripts/create-db.ts
import dotenv from 'dotenv';
import path from 'path';
import { Client } from 'pg';

// 加载环境变量
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function createDatabase() {
  const postgresUrl = process.env.POSTGRES_URL;

  if (!postgresUrl) {
    console.error('❌ POSTGRES_URL is not defined in your .env file.');
    process.exit(1);
  }

  // 从连接字符串中解析出数据库名和其他连接信息
  const url = new URL(postgresUrl);
  const dbName = url.pathname.slice(1);
  
  // 创建一个连接到 *默认* 'postgres' 数据库的客户端
  // 这是关键，因为我们不能连接到一个不存在的数据库
  const client = new Client({
    host: url.hostname,
    port: Number(url.port),
    user: url.username,
    password: url.password,
    database: 'postgres', // 连接到默认数据库
  });

  try {
    await client.connect();
    console.log('✅ Connected to the default "postgres" database.');

    // 检查我们的目标数据库是否已经存在
    const res = await client.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [dbName]);

    if (res.rowCount === 0) {
      console.log(`⏳ Database "${dbName}" does not exist. Creating it now...`);
      await client.query(`CREATE DATABASE "${dbName}"`);
      console.log(`✅ Database "${dbName}" created successfully.`);
    } else {
      console.log(`🟢 Database "${dbName}" already exists. Skipping creation.`);
    }
  } catch (error) {
    console.error('❌ An error occurred during database creation:', error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('Disconnected from the "postgres" database.');
  }
}

createDatabase();