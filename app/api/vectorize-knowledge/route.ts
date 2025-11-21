// app/api/vectorize-knowledge
import { NextResponse } from "next/server"
import { getDbInstance } from "@/lib/db"
import { join } from "path"
import { initializeGlobalProxy } from "@/lib/llm/model-service";
import type { GoogleFileSearch } from "@/lib/db/google";

export async function POST(request: Request) {
  // 如果调用的是Google Gen AI的向量模型，必须要配置网络代理。
  initializeGlobalProxy();

  try {
    const body = await request.json()
    const { projectName, databaseType, embeddingModel, googleStoreName, force = false } = body

    if (!projectName || !databaseType) {
      return NextResponse.json({ error: "缺少必要的参数" }, { status: 400 })
    }

    if (databaseType !== 'GOOGLE' && !embeddingModel) {
       return NextResponse.json({ error: "缺少 embeddingModel 参数" }, { status: 400 })
    }

    if (databaseType === 'GOOGLE' && !googleStoreName) {
       return NextResponse.json({ error: "缺少 Google Store Name 参数" }, { status: 400 })
    }

    console.log(`Starting knowledge base vectorization for project: ${projectName}`)
    console.log(`Database type: ${databaseType}, Embedding model: ${embeddingModel}`)
    console.log(`[API] Vectorize Project: ${projectName}, DB: ${databaseType}, Force: ${force}`)

    // 创建数据库实例（使用前端配置的数据库类型和嵌入模型）
    // 如果 Type 是 GOOGLE，embeddingModel 参数传递的是 storeName
    const modelParam = databaseType === 'GOOGLE' ? googleStoreName : embeddingModel;
    const db = await getDbInstance(databaseType, modelParam)

    // Google 特有逻辑：检查存在性
    if (databaseType === 'GOOGLE') {
      // 使用类型断言来调用 checkStoreExists
      const googleDb = db as unknown as GoogleFileSearch;

      // 只有当 db 对象确实有 checkStoreExists 方法时才检查
      if (typeof googleDb.checkStoreExists === 'function') {
        const exists = await googleDb.checkStoreExists();

        if (exists && !force) {
          // 如果存在且没有强制覆盖，返回 409 Conflict
          console.log(`[API] Store exists, waiting for user confirmation.`);
          return NextResponse.json(
            { error: "Google File Store 已存在", exists: true },
            { status: 409 }
          );
        }
      }
    }

    // 执行数据库迁移（创建表结构等）
    console.log('Running database migration...')
    await db.migrate()

    // 执行数据种子（向量化知识库文件）
    console.log('Starting knowledge base seeding...')
    const knowledgePath = join(process.cwd(), 'output', 'project', projectName, 'knowledge')
    await db.seed(knowledgePath)

    return NextResponse.json({
      success: true,
      message: "知识库向量化完成",
      databaseType: databaseType,
      embeddingModel: embeddingModel,
      googleStoreName: googleStoreName,
      projectName: projectName
    })
  } catch (error) {
    console.error("向量化知识库时发生错误:", error)
    return NextResponse.json(
      { error: "向量化知识库失败: " + (error instanceof Error ? error.message : "未知错误") },
      { status: 500 }
    )
  }
}