// lib/db/core/embed-config.ts
import { getEmbeddingModels as getAllEmbeddingModels } from '../../config/database-config';
import { GoogleGenAI } from "@google/genai";

// Google Gen AI 客户端单例
let genAIClient: GoogleGenAI | null = null;
function getGoogleGenAIClient(): GoogleGenAI {
  if (!genAIClient) {
    if (!process.env.GOOGLE_API_KEY) {
      throw new Error("配置错误: 环境变量 GOOGLE_API_KEY 未定义。请在 .env 文件中设置它。");
    }
    genAIClient = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });
    console.log("[Embedding Service] Google GenAI (New SDK) Client initialized.");
  }
  return genAIClient;
}

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
 * Google AI SDK 获取 Gemini 模型的向量
 */
async function getGeminiEmbedding(
  text: string,
  task: 'search_query' | 'search_document',
  modelName: string
): Promise<number[]> {
  const ai = getGoogleGenAIClient();

  // 从配置中获取为该模型设定的维度
  const outputDimension = getModelDimensions(modelName);
  console.log(`[Embedding Service] Generating Gemini embedding with output dimension: ${outputDimension}`);

  // 映射任务类型到 Gemini SDK 的 TaskType
  const taskType = task === 'search_document'
      ? 'RETRIEVAL_DOCUMENT'
      : 'RETRIEVAL_QUERY';

  const result = await ai.models.embedContent({
    model: modelName,
    contents: [text],
    config: {
      taskType: taskType,
      outputDimensionality: outputDimension,
    },
  });

  const embeddings = result.embeddings;
  if (!embeddings) {
    throw new Error('Gemini API failed to return a valid embedding.');
  }
  const embedding = embeddings[0]
  if (!embedding || !embedding.values) {
    throw new Error('Gemini API failed to return a valid embedding.');
  }
  return embedding.values;
}

/**
 * 获取本地 Ollama 模型的向量
 */
async function getOllamaEmbedding(
  text: string,
  task: 'search_query' | 'search_document',
  modelName: string
): Promise<number[]> {
  const apiUrl = process.env.EMBEDDING_MODEL_URL;
  if (!apiUrl) {
    throw new Error("配置错误: 环境变量 EMBEDDING_MODEL_URL 未定义。");
  }

  let processedText = text;

  // nomic-embed-text 模型需要特定前缀
  if (modelName.includes('nomic-embed-text')) {
    processedText = `${task}: ${text}`;
  }

  // --- 调用 Ollama API ---
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: modelName, prompt: processedText }),
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
  const effectiveModel = modelName || process.env.EMBEDDING_MODEL_TYPE;
  if (!effectiveModel) {
    throw new Error("getEmbedding 函数调用错误: 必须提供 modelName 参数。");
  }

  if (effectiveModel.includes('gemini-embedding')) {
    // 如果是 Gemini 模型，调用 Google AI 的函数
    console.log(`[Embedding Service] Using Google AI provider for model: ${effectiveModel}`);
    return getGeminiEmbedding(text, task, effectiveModel);
  } else {
    // 否则，默认使用 Ollama 的函数
    console.log(`[Embedding Service] Using Ollama provider for model: ${effectiveModel}`);
    return getOllamaEmbedding(text, task, effectiveModel);
  }
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