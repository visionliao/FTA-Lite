"use client"

import type React from "react"

import { useEffect } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { ModelParams } from "@/components/model-params"
import { useAppStore } from "@/store/app-store"

interface Model {
  name: string;
  provider: string;
  color: string;
}

export function ModelSettings() {
  const {
    modelSettingsConfig: {
      models,
      providers,
      workModel,
      scoreModel,
      workModelParams,
      scoreModelParams
    },
    setModels,
    setProviders,
    setWorkModel,
    setScoreModel,
    setWorkModelParams,
    setScoreModelParams
  } = useAppStore()

  // 动态获取模型配置
  useEffect(() => {
    const loadModels = async () => {
      try {
        const response = await fetch('/api/models')
        if (!response.ok) {
          throw new Error('Failed to load model configurations')
        }

        const data = await response.json()
        const { providers, models: allModels, defaultModels } = data

        const providerConfigs: {[key: string]: any} = {}

        // 转换API返回的数据格式
        Object.entries(providers).forEach(([provider, config]: [string, any]) => {
          providerConfigs[provider] = {
            apiKey: config.apiKey,
            modelList: config.modelList,
            displayName: config.displayName,
            color: config.color
          }
        })

        setProviders(providerConfigs)
        setModels(allModels)

        // 检查默认模型是否在模型列表中
        const isValidModel = (modelName: string) => allModels.some((model: any) => model.name === modelName)

        // 检查是否需要设置默认模型
        const shouldSetDefaults = !workModel || !scoreModel ||
                               !isValidModel(workModel) || !isValidModel(scoreModel)

        if (shouldSetDefaults) {
          console.log('Setting default models:', defaultModels)

          // 强制设置默认值
          const workModelToSet = isValidModel(defaultModels.workModel) ? defaultModels.workModel : allModels[0]?.name || ''
          const scoreModelToSet = isValidModel(defaultModels.scoreModel) ? defaultModels.scoreModel : allModels[0]?.name || ''

          setWorkModel(workModelToSet)
          setScoreModel(scoreModelToSet)
        }
      } catch (error) {
        console.error('Error loading model configurations:', error)
      }
    }

    // 首次加载或模型列表为空时，都重新加载
    const shouldLoad = !models || models.length === 0 || !workModel || !scoreModel
    if (shouldLoad) {
      console.log('Loading model configurations...')
      loadModels()
    }
  }, [models?.length, workModel, scoreModel])

  // 获取模型提供商显示名称
  const getModelProvider = (modelName: string) => {
    const model = (models || []).find(m => m.name === modelName)
    if (!model || !providers[model.provider]) return ''
    return providers[model.provider]?.displayName || ''
  }

  // 辅助函数：格式化模型名称，用于在下拉列表中显示
  const getModelDisplayName = (model: Model): string => {
    const providerConfig = providers[model.provider];
    if (!providerConfig) return model.name; // 如果找不到，则回退到完整名称

    // 从完整名称中提取第一个冒号后面的模型部分
    const modelNamePart = model.name.substring(model.name.indexOf(':') + 1);
    return `${providerConfig.displayName}: ${modelNamePart}`;
  };

  // 获取模型颜色
  const getModelColor = (modelName: string) => {
    const model = (models || []).find(m => m.name === modelName)
    if (!model) return 'gray'
    return model.color
  }

  return (
    <div className="p-4 md:p-8 max-w-full md:max-w-4xl lg:max-w-5xl xl:max-w-6xl mx-auto">
      <div className="mb-6 border-b border-border pb-4 md:mb-8">
        <h1 className="text-xl font-semibold text-foreground md:text-2xl">模型设置</h1>
      </div>

      <div className="space-y-6 md:space-y-8">
        {/* 工作模型 */}
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-medium text-foreground">工作模型</Label>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {workModel ? getModelProvider(workModel) : '无可用模型'}
                </div>
              </div>
              <Select value={workModel} onValueChange={setWorkModel}>
                <SelectTrigger className="w-full md:w-80">
                  <SelectValue placeholder="选择模型" />
                </SelectTrigger>
                <SelectContent>
                  {(models || []).map((model) => (
                    <SelectItem key={model.name} value={model.name}>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${model.color === 'gray' ? 'bg-gray-500' : model.color === 'blue' ? 'bg-blue-500' : model.color === 'green' ? 'bg-green-500' : model.color === 'red' ? 'bg-red-500' : model.color === 'yellow' ? 'bg-yellow-500' : 'bg-purple-500'}`}></div>
                        {model.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {/* 工作模型参数设置 */}
          <ModelParams
            config={workModelParams}
            onChange={setWorkModelParams}
            title="工作模型参数设置"
            defaultExpanded={false}
          />
        </div>

        {/* 评分模型 */}
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-medium text-foreground">评分模型</Label>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {scoreModel ? getModelProvider(scoreModel) : '无可用模型'}
                </div>
              </div>
              <Select value={scoreModel} onValueChange={setScoreModel}>
                <SelectTrigger className="w-full md:w-80">
                  <SelectValue placeholder="选择模型" />
                </SelectTrigger>
                <SelectContent>
                  {(models || []).map((model) => (
                    <SelectItem key={model.name} value={model.name}>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${model.color === 'gray' ? 'bg-gray-500' : model.color === 'blue' ? 'bg-blue-500' : model.color === 'green' ? 'bg-green-500' : model.color === 'red' ? 'bg-red-500' : model.color === 'yellow' ? 'bg-yellow-500' : 'bg-purple-500'}`}></div>
                        {model.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 评分模型参数设置 */}
          <ModelParams
            config={scoreModelParams}
            onChange={setScoreModelParams}
            title="评分模型参数设置"
            defaultExpanded={false}
          />
        </div>

      </div>
    </div>
  )
}
