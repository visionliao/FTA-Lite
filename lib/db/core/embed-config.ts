// lib/db/core/embed-config.ts
function getEmbeddingConfig() {
    // 从环境变量中读取配置
    const apiUrl = process.env.EMBEDDING_MODEL_URL;
    const modelName = process.env.EMBEDDING_MODEL;
    const dimesions = process.env.EMBEDDING_DIMENSIONS;

    // 1. 运行时检查
    if (!apiUrl || !modelName) {
        throw new Error("EMBEDDING_MODEL_URL and EMBEDDING_MODEL must be defined in .env");
    }

    // 2. 返回一个对象，TypeScript 此时可以确信这两个值都是 string 类型
    return {
        OLLAMA_API_URL: apiUrl,
        OLLAMA_MODEL: modelName,
        EMBEDDING_DIMENSIONS: dimesions,
    };
}

// 只调用一次配置函数
const { OLLAMA_API_URL, OLLAMA_MODEL, EMBEDDING_DIMENSIONS } = getEmbeddingConfig();
console.log(`Embedding Service Initialized with model: ${OLLAMA_MODEL}`);

/**
 * 获取模型向量维度。
 * - 如果 .env 中定义了有效的维度，则使用该维度。
 * - 如果未定义，则回退到默认值 1024，并打印一条警告。
 * - 如果定义了但值无效（非数字），则抛出错误。
 * @returns {number} 向量维度
 */
export function getModelDimensions(): number {
    const defaultValue = 1024;

    // 检查环境变量是否已设置且不为空字符串
    if (EMBEDDING_DIMENSIONS && EMBEDDING_DIMENSIONS.trim() !== '') {
        const parsedDim = parseInt(EMBEDDING_DIMENSIONS, 10);
        
        // 检查解析后的值是否是有效数字
        if (!isNaN(parsedDim)) {
            return parsedDim; // 配置有效，直接返回
        } else {
            // 配置存在但无效，这种情况应该中断程序，因为它明确是一个配置错误
            console.error(`[CONFIG ERROR] EMBEDDING_DIMENSIONS is set to an invalid value: "${EMBEDDING_DIMENSIONS}". It must be a number.`);
            throw new Error(`Invalid EMBEDDING_DIMENSIONS value.`);
        }
    }

    // --- 执行回退逻辑 ---
    // 环境变量未设置或为空，使用默认值并打印警告
    console.warn('--------------------------------------------------------------------');
    console.warn(`[CONFIG WARNING] EMBEDDING_DIMENSIONS is not set in your .env file.`);
    console.warn(`Falling back to default dimension: ${defaultValue}.`);
    console.warn(`PLEASE ENSURE this matches the output of your model ('${OLLAMA_MODEL}') to avoid errors during data seeding.`);
    console.warn('--------------------------------------------------------------------');
    
    return defaultValue;
}

/**
 * 通用的向量化函数，会根据模型名称自动处理特定逻辑（如添加前缀）。
 * @param text 要向量化的文本
 * @param task 任务类型，用于模型特定的前缀处理
 * @returns 向量数组 (number[])
 */
export async function getEmbedding(
  text: string,
  task: 'search_query' | 'search_document'
): Promise<number[]> {
  
  let processedText = text;

  // nomic-embed-text 这个模型为了在检索任务中达到最佳效果，其开发者建议在生成向量时，
  // 根据文本的用途（是用于存储的文档，还是用于搜索的查询）添加不同的前缀。这样做可以使查询向量和文档向量在向量空间中的分布更有利于检索。
  // 而 qwen-embedding 这样的模型，则没有这个前缀要求。
  if (OLLAMA_MODEL.includes('nomic-embed-text')) {
    processedText = `${task}: ${text}`;
  }

  // --- 调用 Ollama API ---
  const response = await fetch(OLLAMA_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: OLLAMA_MODEL, prompt: processedText }),
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
export async function getEmbeddings(texts: string[]): Promise<number[][]> {
    console.log(`[Embedding Service] Generating embeddings for ${texts.length} documents...`);
    const embeddings: number[][] = [];
    for (const text of texts) {
        const embedding = await getEmbedding(text, 'search_document');
        embeddings.push(embedding);
    }
    return embeddings;
}