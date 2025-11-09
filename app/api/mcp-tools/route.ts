// app/api/mcp-tools/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { ToolClient } from '@/lib/llm/tools/tool-client';
import { getToolClientInstance } from '@/lib/llm/tools/tool-client-manager';

interface TestRequestBody {
  url: string;
}

interface TestResponse {
  status: 'ok' | 'error';
  serverType: string;
  url: string;
  toolsCount: number;
  tools?: unknown[];
  message: string;
  error?: string;
  details?: string;
}

// MCP服务器连通性测试
export async function POST(request: NextRequest): Promise<NextResponse<TestResponse>> {
  try {
    const body = await request.json() as TestRequestBody;
    const url = body.url;

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ 
        status: 'error',
        serverType: 'unknown',
        url: url || '',
        toolsCount: 0,
        message: 'URL is required'
      } as TestResponse, { status: 400 });
    }

    console.log(`--- [MCP Test] Testing connection to: ${url} ---`);

    try {
      // 使用ToolClient测试连接
      const client = new ToolClient(url);

      // 测试获取工具列表
      const tools = await client.getToolsSchema();

      // 验证至少有一个工具
      if (!tools || tools.length === 0) {
        throw new Error('No tools available on the server');
      }

      // 获取检测到的服务器类型
      const detectedServerType = await client.getServerType();
      const serverType = detectedServerType === 'fastmcp' ? 'FastMCP' :
                        detectedServerType === 'fastapi' ? 'FastAPI' : 'Unknown';

      const result: TestResponse = {
        status: 'ok',
        serverType,
        url,
        toolsCount: tools.length,
        tools: tools.slice(0, 3), // 返回前3个工具作为示例
        message: `Successfully connected to ${serverType} server with ${tools.length} tools`
      };

      return NextResponse.json(result, { status: 200 });
    } catch (clientError) {
      console.error('[MCP Test] ToolClient error:', clientError);
      // 回退到简单的HTTP健康检查
      try {
        const targetUrl = url.endsWith('/sse') ? url.replace('/sse', '') : url;
        const response = await fetch(targetUrl, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
          throw new Error(`HTTP status: ${response.status}`);
        }

        await response.json(); // 确保可以解析JSON
        return NextResponse.json({
          status: 'ok',
          serverType: 'FastAPI (HTTP fallback)',
          url,
          toolsCount: 0,
          message: 'Connected via HTTP fallback (ToolClient failed)'
        } as TestResponse, { status: 200 });
      } catch (httpError) {
        const errorMessage = `Both ToolClient and HTTP fallback failed. ToolClient: ${(clientError as Error).message}, HTTP: ${httpError instanceof Error ? httpError.message : String(httpError)}`;
        return NextResponse.json({ 
          status: 'error',
          serverType: 'unknown',
          url,
          toolsCount: 0,
          message: 'Failed to connect to MCP server',
          error: errorMessage,
          details: errorMessage
        } as TestResponse, { status: 500 });
      }
    }
  } catch (error) {
    console.error('MCP Test JSON Parse Error:', error);
    return NextResponse.json({ 
      status: 'error',
      serverType: 'unknown',
      url: '',
      toolsCount: 0,
      message: 'Invalid request format',
      error: error instanceof Error ? error.message : String(error)
    } as TestResponse, { status: 400 });
  }
}

// 获取完整的 MCP 工具列表
export async function GET(request: NextRequest) {
  // 从请求的 URL 中获取查询参数
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');

  // 1. 验证 'url' 参数是否存在
  if (!url) {
    return NextResponse.json(
      { success: false, error: 'URL query parameter is required' },
      { status: 400 }
    );
  }

  console.log(`--- [MCP GET] Fetching tools from: ${url} ---`);

  try {
    // 2. 使用 ToolClient 从指定的 URL 获取工具
    const client = getToolClientInstance(url);
    const toolsSchema = await client.getToolsSchema();

    // 处理未返回任何工具的情况
    if (!toolsSchema || toolsSchema.length === 0) {
      return NextResponse.json({ success: true, tools: [] }, { status: 200 });
    }
    console.log(`--- 获取工具列表结果： ${JSON.stringify(toolsSchema, null, 2)}`);

    // 3. 成功时，返回包含工具列表的 JSON 响应
    //    这里的 { success: true, tools: tools } 格式与你前端代码的期望完全匹配
    return NextResponse.json({ success: true, tools: toolsSchema }, { status: 200 });

  } catch (error) {
    // 4. 发生错误时，记录错误并返回一个标准的错误响应
    console.error(`[MCP GET] Error fetching tools from ${url}:`, error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch tools from MCP server',
        details: error instanceof Error ? error.message : String(error) 
      }, 
      { status: 500 }
    );
  }
}