// lib/db/index.ts
import { DataAccess } from './core/interface';

let dbInstance: DataAccess | null = null;
/**
 * 数据库工厂函数 (Singleton)
 * 根据环境变量 DATABASE_TYPE 返回已初始化的数据库实例。
 */
export const getDbInstance = async (): Promise<DataAccess> => {
  if (dbInstance) {
    return dbInstance;
  }

  const dbType = process.env.DATABASE_TYPE;
  console.log(`Attempting to initialize database of type: ${dbType}`);

  switch (dbType) {
    case 'POSTGRES':
      // 动态导入
      const { PostgresDB } = await import('./pg');
      dbInstance = new PostgresDB();
      break;
    case 'CHROMA':
      // 动态导入
      const { ChromaDB } = await import('./chroma');
      dbInstance = new ChromaDB();
      break;
    // case 'DATABRICKS':
    //   dbInstance = new DatabricksDB();
    //   break;
    default:
      throw new Error(`Unsupported DATABASE_TYPE: ${dbType}. Check your .env config.`);
  }

  // 初始化数据库连接
  await dbInstance.init();

  return dbInstance;
};