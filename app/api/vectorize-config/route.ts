// app/api/vectorize-config/route.ts
import { NextResponse } from 'next/server';
import {
  getDatabaseTypes,
  getEmbeddingModels,
  getRerankerModels,
  getEmbeddingDimensions
} from '@/lib/config/database-config';

// 这个 GET 函数只会在服务器端执行
export async function GET() {
  try {
    // 在服务器端安全地调用这些函数
    const databaseTypes = getDatabaseTypes();
    const embeddingModels = getEmbeddingModels();
    const rerankerModels = getRerankerModels();

    // 将非敏感的配置信息作为 JSON 返回给前端
    return NextResponse.json({
      databaseTypes,
      embeddingModels,
      rerankerModels,
    });

  } catch (error) {
    // 如果读取配置失败（例如 .env 文件有问题），返回一个错误
    console.error("Failed to load server configuration:", error);
    return NextResponse.json(
      { error: "无法加载服务器配置。" + (error instanceof Error ? error.message : "") },
      { status: 500 }
    );
  }
}