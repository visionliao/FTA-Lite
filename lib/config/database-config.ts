// lib/config/database-config.ts
/**
 * 从环境变量中解析数据库类型列表
 */
export function getDatabaseTypes(): string[] {
  const list = process.env.DATABASE_LIST;
  if (!list) {
    throw new Error("配置错误: 环境变量 DATABASE_LIST 未定义。请在 .env 文件中设置它 (例如: 'POSTGRES,CHROMA')。");
  }

  return list.split(',').map(item => item.trim()).filter(Boolean);
}

/**
 * 从环境变量中解析向量模型列表
 */
export function getEmbeddingModels(): { name: string; dimensions: number }[] {
  const models = process.env.EMBEDDING_MODEL_LIST;
  const dimensions = process.env.EMBEDDING_DIMENSIONS_LIST;

  if (!models) {
    throw new Error("配置错误: 环境变量 EMBEDDING_MODEL_LIST 未定义。请在 .env 文件中设置它 (例如: 'nomic-embed-text:latest,qwen3-embedding:0.6b')。");
  }
  if (!dimensions) {
    throw new Error("配置错误: 环境变量 EMBEDDING_DIMENSIONS_LIST 未定义。请在 .env 文件中设置它 (例如: '768,1024')。");
  }

  const modelList = models.split(',').map(item => item.trim()).filter(Boolean);
  const dimensionList = dimensions.split(',').map(item => parseInt(item.trim())).filter(dim => !isNaN(dim));

  if (modelList.length !== dimensionList.length) {
    throw new Error(
      "配置错误: EMBEDDING_MODEL_LIST 中的模型数量与 EMBEDDING_DIMENSIONS_LIST 中的维度数量不匹配。" +
      `\n  模型数量: ${modelList.length}` +
      `\n  维度数量: ${dimensionList.length}`
    );
  }

  return modelList.map((model, index) => ({
    name: model,
    dimensions: dimensionList[index]
  }));
}

/**
 * 从环境变量中解析重排序模型列表
 */
export function getRerankerModels(): { name: string; description: string }[] {
  const models = process.env.RERANKER_MODEL_LIST;

  if (!models) {
    throw new Error("配置错误: 环境变量 RERANKER_MODEL_LIST 未定义。请在 .env 文件中设置它。");
  }

  return models.split(',').map(item => item.trim()).filter(Boolean).map(model => {
    let description = '';

    // 根据模型名称生成描述
    if (model.includes('bge-reranker-v2-m3')) {
      description = '支持多语言，占用运行时内存2.2G(RAM) (*** 推荐 ***)';
    } else if (model.includes('Qwen3-Reranker-4B') && !model.includes('Q4_K_M')) {
      description = '支持多语言，占用运行时内存约8G(RAM)(一般个人电脑无法运行）';
    } else if (model.includes('Qwen3-Reranker-4B:Q4_K_M')) {
      description = '支持多语言，占用运行时内存约2.5G(RAM)，Qwen/Qwen3-Reranker-4B 的量化版本';
    } else if (model.includes('Qwen3-Reranker-0.6B')) {
      description = '支持多语言，占用运行时内存1.2G(RAM)';
    } else {
      description = '支持多语言的重排序模型';
    }

    return { name: model, description };
  });
}

/**
 * 获取向量模型的维度
 */
export function getEmbeddingDimensions(modelName: string): number | undefined {
  const models = getEmbeddingModels();
  const model = models.find(m => m.name === modelName);
  return model?.dimensions;
}

/**
 * 获取当前环境为 scripts/ 脚本配置的默认数据库类型。
 */
export function getCurrentDatabaseType(): string {
  const dbType = process.env.DATABASE_TYPE;

  if (!dbType) {
    throw new Error("配置错误: 环境变量 DATABASE_TYPE 未定义。请在 .env 文件中为脚本执行设置默认数据库类型。");
  }

  return dbType;
}