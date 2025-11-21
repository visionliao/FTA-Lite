// lib/db/index.ts
import { DataAccess } from './core/interface';

// --- 全局实例池 ---
// 在 globalThis 上声明，以在 Next.js 的热重载开发环境中保持状态
declare global {
  var dbInstancePool: Map<string, DataAccess> | undefined;
}

// 初始化实例池
const dbInstancePool = global.dbInstancePool || (global.dbInstancePool = new Map<string, DataAccess>());

/**
 * 数据库工厂函数 (Singleton)
 * 根据环境变量 DATABASE_TYPE 返回已初始化的数据库实例。
 */
export const getDbInstance = async (
  dbType?: string,
  embeddingModel?: string
): Promise<DataAccess> => {
  // 1. 优先使用传入的参数，否则回退到环境变量
  const effectiveDbType = dbType || process.env.DATABASE_TYPE;
  console.log(`Attempting to initialize database of type: ${effectiveDbType}`);
  const effectiveEmbeddingModel = embeddingModel || process.env.EMBEDDING_MODEL_TYPE;

  if (!effectiveDbType || !effectiveEmbeddingModel) {
    throw new Error("Database type or embedding model is not configured.");
  }

  // 2. 创建一个唯一的缓存键
  const cacheKey = `${effectiveDbType}-${effectiveEmbeddingModel}`;

  // 3. 检查缓存中是否已存在实例
  if (dbInstancePool.has(cacheKey)) {
    console.log(`[DB Factory] Returning cached instance for key: ${cacheKey}`);
    return dbInstancePool.get(cacheKey)!;
  }

  // 4. 如果缓存中没有，则创建新实例
  console.log(`[DB Factory] Creating new instance for key: ${cacheKey}`);
  let newInstance: DataAccess;

  switch (effectiveDbType) {
    case 'POSTGRES':
      // 动态导入
      const { PostgresDB } = await import('./pg');
      newInstance = new PostgresDB(embeddingModel);
      break;
    case 'CHROMA':
      // 动态导入
      const { ChromaDB } = await import('./chroma');
      newInstance = new ChromaDB(embeddingModel);
      break;
    // case 'DATABRICKS':
    //   newInstance = new DatabricksDB();
    //   break;
    case 'GOOGLE':
      // Google File Search 不需要本地 embedding 模型
      const { GoogleFileSearch } = await import('./google');
      newInstance = new GoogleFileSearch(embeddingModel);
      break;
    default:
      throw new Error(`Unsupported DATABASE_TYPE: ${effectiveDbType}. Check your .env config.`);
  }

  // 初始化数据库连接
  await newInstance.init();

  // 5. 将新实例存入缓存
  dbInstancePool.set(cacheKey, newInstance);

  return newInstance;
};