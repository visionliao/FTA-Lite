// scripts/inspect-chroma.ts

// 确保 tsx 脚本运行时，dotenv 配置（或 --env-file）已生效
import client from '../lib/db/chroma/client';

async function inspectCollection() {
  const collectionName = "knowledge_base";

  console.log(`正在检查 ChromaDB 集合: "${collectionName}"...`);

  try {
    const collection = await client.getCollection({
      name: collectionName,
    });

    console.log(`成功获取到集合 "${collection.name}" (ID: ${collection.id})。`);

    // =================================================================
    // 关键修正：使用 get() 方法代替 peek()，并明确传入 include 参数
    // =================================================================
    const getResult = await collection.get({
      limit: 1, // 我们只需要一条数据来检查维度
      include: ["embeddings"] // 明确要求返回向量数据
    });

    // 检查是否有数据返回
    if (!getResult || getResult.ids.length === 0) {
      console.log("集合为空，无法确定维度。");
      return;
    }

    console.log(`集合中包含 ${await collection.count()} 条数据。`);

    // 获取第一个向量并检查其长度
    const firstEmbedding = getResult.embeddings?.[0];

    if (firstEmbedding && Array.isArray(firstEmbedding) && firstEmbedding.length > 0) {
      const dimension = firstEmbedding.length;
      console.log("\n✅ 成功确定向量维度!");
      console.log(`----------------------------------------`);
      console.log(`  集合名称: ${collectionName}`);
      console.log(`  向量维度: ${dimension}`);
      console.log(`----------------------------------------`);
    } else {
      console.log("\n❌ 未能从返回的数据中获取有效的嵌入向量。");
      console.log("   请确认知识库在向量化时是否成功生成了向量。");
      console.log("   get() 方法返回结果预览:", getResult);
    }

  } catch (error) {
    console.error(`\n检查集合时发生错误:`, error);
    if (error instanceof Error && error.message.includes('does not exist')) {
        console.log(`错误提示：集合 "${collectionName}" 不存在。请先运行向量化流程创建集合。`);
    } else {
        console.log(`请确保 ChromaDB 服务正在运行，并且您有权限访问它。`);
    }
  }
}

inspectCollection();