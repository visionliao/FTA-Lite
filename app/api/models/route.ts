import { NextRequest, NextResponse } from 'next/server'

// 定义模型接口
interface ModelInfo {
  name: string; // 格式: "provider:model"
  provider: string;
  color: string;
}

export async function GET() {
  try {
    // 获取所有环境变量
    const allEnvVars = process.env

    // 找到所有API_KEY和MODEL_LIST配置
    const providerConfigs: { [key: string]: any } = {}
    const allModels: any[] = []

    // 颜色数组
    const colors = ['blue', 'green', 'purple', 'orange', 'red', 'cyan', 'yellow', 'pink', 'indigo', 'teal']
    let colorIndex = 0

    // 遍历环境变量，动态查找所有API_KEY配置
    Object.keys(allEnvVars).forEach(key => {
      if (key.endsWith('_API_KEY')) {
        const provider = key.replace('_API_KEY', '').toLowerCase()
        const modelListKey = key.replace('_API_KEY', '_MODEL_LIST')

        const apiKey = allEnvVars[key] || ''
        const modelListStr = allEnvVars[modelListKey] || ''

        if (apiKey && modelListStr) {
          const modelList = modelListStr.split(',').filter(Boolean)
          const displayName = provider.charAt(0).toUpperCase() + provider.slice(1)
          const color = colors[colorIndex % colors.length]

          providerConfigs[provider] = {
            // apiKey, // 安全起见，不要把 API Key 发给前端
            displayName,
            color
          }

          // 为每个模型创建配置
          modelList.forEach(modelName => {
            allModels.push({
              name: `${provider}:${modelName}`,
              provider,
              color
            })
          })

          colorIndex++
        }
      }
    });

    // 辅助函数：将 .env 中的短名称解析为 "provider:model" 的长名称
    const resolveDefaultModel = (rawName: string | undefined): string => {
      if (!rawName) return '';
      const trimmedName = rawName.trim();

      // 情况A: .env 里已经写了前缀 (例如 "google:gemini-...")
      const exactMatch = allModels.find(m => m.name === trimmedName);
      if (exactMatch) return exactMatch.name;

      // 情况B: .env 里只写了模型名 (例如 "gemini-...")，这是您当前的情况
      // 我们在 allModels 里找一个结尾匹配的
      const suffixMatch = allModels.find(m => m.name.endsWith(`:${trimmedName}`));
      if (suffixMatch) {
        // 找到了！返回带前缀的完整名称
        return suffixMatch.name;
      }

      // 情况C: 没找到，原样返回（前端会处理为不选中或选第一个）
      return trimmedName;
    };

    // 获取默认模型配置
    const defaultModels = {
      promptModel: resolveDefaultModel(process.env.DEFAULT_PROMPT_MODEL),
      workModel: resolveDefaultModel(process.env.DEFAULT_WORK_MODEL),
      scoreModel: resolveDefaultModel(process.env.DEFAULT_SCORE_MODEL)
    }

    return NextResponse.json({
      providers: providerConfigs,
      models: allModels,
      defaultModels
    })
  } catch (error) {
    console.error('Error loading model configurations:', error)
    return NextResponse.json({ error: 'Failed to load model configurations' }, { status: 500 })
  }
}