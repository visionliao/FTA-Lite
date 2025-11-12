// lib/reranker/reranker-service.ts
import { RERANKER_CONFIG } from './rerankerConfig';

// 指向重排序服务的 Python 服务的 URL
const RERANK_API_URL = 'http://localhost:5000/rerank';

// 文档在发送重排序前的接口定义
export interface RerankInput {
  index: number; // 来自向量数据库结果的原始索引
  content: string;
}

// 文档在重排序后的接口定义
export interface RerankResult {
  index: number; // 相同的原始索引，现在位于一个排好序的列表中
  content: string;
  score: number;
}

/**
 * 一个调用外部重排序服务的通用函数。
 * 
 * @param query 用户的搜索查询。
 * @param documents 从向量数据库检索到的文档列表。
 * @param modelName 用于重排序的模型名称 (例如, 'BAAI/bge-reranker-v2-m3')。
 * @returns 一个 Promise，它会解析为一个排好序的重排序文档列表。
 */
export async function rerankDocuments(
  query: string,
  documents: RerankInput[],
): Promise<RerankResult[]> {
  if (!documents || documents.length === 0) {
    return [];
  }

  // 从导入的配置中获取模型名称
  const { modelName } = RERANKER_CONFIG;

  console.log(`[Reranker] 正在使用模型 ${modelName} 调用通用重排序服务处理 ${documents.length} 个文档`);

  try {
    const response = await fetch(RERANK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      // 请求体现在包含了模型名称和完整的文档对象
      body: JSON.stringify({
        model: modelName,
        query: query,
        documents: documents,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Reranker] API 请求失败，状态码 ${response.status}:`, errorText);
      throw new Error(`Rerank API 错误: ${errorText}`);
    }

    const data: { results: RerankResult[] } = await response.json();

    // 后端现在返回了所有内容，并且已经按正确的原始索引完美排序。
    // 前端不再需要做任何映射工作。
    const finalResults = data.results;

    console.log(`[Reranker] 重排序完成。最高分: ${finalResults[0]?.score.toFixed(4)}`);
    return finalResults;

  } catch (error: any) {
    console.error('[Reranker] 重排序过程中发生严重错误:', error.message);
    // 重新抛出错误，以便调用函数可以处理它
    throw error;
  }
}