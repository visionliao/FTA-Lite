// lib/db/core/embed-config.ts
import { getEmbeddingModels as getAllEmbeddingModels } from '../../config/database-config';

/**
 * 获取模型向量维度。
 * - 如果 .env 中定义了有效的维度，则使用该维度。
 * - 如果未定义，则回退到默认值 1024，并打印一条警告。
 * - 如果定义了但值无效（非数字），则抛出错误。
 * @returns {number} 向量维度
 */
export function getModelDimensions(modelName?: string): number {
    const effectiveModelName = modelName || process.env.EMBEDDING_MODEL_TYPE;
    if (!effectiveModelName) {
      console.warn('Embedding model name not specified, falling back to default dimension 768.');
      return 1024;
    }

    const allModels = getAllEmbeddingModels();
    const model = allModels.find(m => m.name === effectiveModelName);

    if (model) {
      return model.dimensions;
    }

    console.warn(`Dimensions for model '${effectiveModelName}' not found in config. Falling back to default 768.`);
    return 1024; // 默认维度
}

/**
 * 通用的向量化函数，会根据模型名称自动处理特定逻辑（如添加前缀）。
 * @param text 要向量化的文本
 * @param task 任务类型，用于模型特定的前缀处理
 * @returns 向量数组 (number[])
 */
export async function getEmbedding(
  text: string,
  task: 'search_query' | 'search_document',
  modelName?: string
): Promise<number[]> {
  // 1. 配置在“运行时”才被读取和校验
  const apiUrl = process.env.EMBEDDING_MODEL_URL;
  if (!apiUrl) {
    throw new Error("配置错误: 环境变量 EMBEDDING_MODEL_URL 未定义。");
  }

  const OLLAMA_MODEL = process.env.EMBEDDING_MODEL_TYPE;
  const effectiveModel = modelName || OLLAMA_MODEL;
  if (!effectiveModel) {
    throw new Error("getEmbedding 函数调用错误: 必须提供 modelName 参数。");
  }

  let processedText = text;

  // nomic-embed-text 这个模型为了在检索任务中达到最佳效果，其开发者建议在生成向量时，
  // 根据文本的用途（是用于存储的文档，还是用于搜索的查询）添加不同的前缀。这样做可以使查询向量和文档向量在向量空间中的分布更有利于检索。
  // 而 qwen-embedding 这样的模型，则没有这个前缀要求。
  if (effectiveModel.includes('nomic-embed-text')) {
    processedText = `${task}: ${text}`;
  }

  // --- 调用 Ollama API ---
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: effectiveModel, prompt: processedText }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`Ollama API request failed: ${response.status} ${response.statusText}`, errorBody);
    throw new Error(`Ollama API request failed: ${response.statusText}`);
  }

  const data = await response.json() as { embedding: number[] };
  return data.embedding;
}

/**
 * 批量获取向量的函数，供 ChromaDB 的 EmbeddingFunction 使用
 * @param texts 文本数组
 * @returns 向量的二维数组
 */
export async function getEmbeddings(texts: string[], modelName?: string): Promise<number[][]> {
    const OLLAMA_MODEL = process.env.EMBEDDING_MODEL_TYPE;
    const effectiveModel = modelName || OLLAMA_MODEL;

    if (!effectiveModel) {
        throw new Error("getEmbeddings 函数调用错误: 无法确定模型名称。");
    }

    console.log(`[Embedding Service] 正在使用模型 ${effectiveModel} 为 ${texts.length} 个文档生成向量...`);

    return Promise.all(
        texts.map(text => getEmbedding(text, 'search_document', effectiveModel)) // 传递确定的模型
    );
}