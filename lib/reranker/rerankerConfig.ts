/**
 * 此文件负责从环境变量中读取和导出重排序服务的相关配置。
 * 这确保了配置的中心化管理，并与业务逻辑解耦。
 */

// 从环境变量中读取模型名称。
// process.env.RERANKER_MODEL 会读取 .env 文件中的 RERANKER_MODEL 变量。
const rerankerModelName = process.env.RERANKER_MODEL;

// 安全检查：如果环境变量没有设置，则抛出一个明确的错误。
// 这可以防止在配置不完整的情况下运行应用程序，避免后续出现难以追踪的 bug。
if (!rerankerModelName) {
  throw new Error(
    "RERANKER_MODEL environment variable is not set. Please define it in your .env file."
  );
}

// 导出配置，供其他文件导入使用。
export const RERANKER_CONFIG = {
  modelName: rerankerModelName,
};