// app/api/vectorize-knowledge
import { NextResponse } from "next/server"
import { getDbInstance } from "@/lib/db"
import { join } from "path"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { projectName, databaseType, embeddingModel } = body

    if (!projectName || !databaseType || !embeddingModel) {
      return NextResponse.json({ error: "缺少必要的参数" }, { status: 400 })
    }

    console.log(`Starting knowledge base vectorization for project: ${projectName}`)
    console.log(`Database type: ${databaseType}, Embedding model: ${embeddingModel}`)

    // 创建数据库实例（使用前端配置的数据库类型和嵌入模型）
    const db = await getDbInstance(databaseType, embeddingModel)

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