// lib/db/core/interface.ts
// 定义文档的通用结构
export interface Document {
  id: string;
  content: string;
  metadata: Record<string, any>;
  similarity?: number; // 相似度
}

// 定义数据访问层的统一接口
export interface DataAccess {
  /**
   * 初始化数据库连接和设置
   */
  init(): Promise<void>;

  /**
   * 添加文档到数据库
   */
  addDocuments(documents: Document[]): Promise<void>;

  /**
   * 从数据库中查询文档
   */
  queryDocuments(query: string, topK: number): Promise<Document[]>;

  /**
   * 确保数据库 Schema (表、索引、扩展等) 是最新的。
   * 这是一个结构性操作。
   */
  migrate(): Promise<void>;

  /**
   * 从指定目录用数据填充知识库。
   * 这是一个数据操作，假定 Schema 已存在。
   */
  seed(directoryPath: string): Promise<void>;
}