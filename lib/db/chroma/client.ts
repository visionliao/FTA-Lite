// lib/db/chroma/client.ts
import { ChromaClient } from 'chromadb';

if (!process.env.CHROMA_URL) {
  throw new Error("CHROMA_URL is not defined in environment variables.");
}

// 为 TypeScript 扩展全局命名空间
declare global {
  var chromaClient: ChromaClient | undefined;
}

// 应用与 pg/client.ts 完全相同的全局缓存逻辑
const chromaClient = global.chromaClient || new ChromaClient({
  path: process.env.CHROMA_URL,
});

// 在非生产环境下，将实例缓存到全局变量中
if (process.env.NODE_ENV !== 'production') {
  global.chromaClient = chromaClient;
}

export default chromaClient;