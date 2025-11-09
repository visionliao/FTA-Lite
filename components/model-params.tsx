"use client"

import type React from "react"
import { useState } from "react"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ChevronDown, ChevronRight } from "lucide-react"

interface ModelParamsConfig {
  streamingEnabled: boolean
  temperature: number[]
  topP: number[]
  presencePenalty: number[]
  frequencyPenalty: number[]
  singleResponseLimit: boolean
  maxTokens: number[]
  maxTokensInput: string
  intelligentAdjustment: boolean
  reasoningEffort: string
}

interface ModelParamsProps {
  config: ModelParamsConfig
  onChange: (config: ModelParamsConfig) => void
  title: string
  defaultExpanded?: boolean
}

export function ModelParams({ config, onChange, title, defaultExpanded = false }: ModelParamsProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  const updateConfig = (updates: Partial<ModelParamsConfig>) => {
    onChange({ ...config, ...updates })
  }

  const handleMaxTokensSliderChange = (value: number[]) => {
    updateConfig({ maxTokens: value, maxTokensInput: value[0].toString() })
  }

  const handleMaxTokensInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    updateConfig({ maxTokensInput: value })
    const numValue = Number.parseInt(value) || 0
    if (numValue >= 0 && numValue <= 32000) {
      updateConfig({ maxTokens: [numValue] })
    }
  }

  const incrementTokens = () => {
    const newValue = Math.min(config.maxTokens[0] + 100, 32000)
    updateConfig({ maxTokens: [newValue], maxTokensInput: newValue.toString() })
  }

  const decrementTokens = () => {
    const newValue = Math.max(config.maxTokens[0] - 100, 0)
    updateConfig({ maxTokens: [newValue], maxTokensInput: newValue.toString() })
  }

  return (
    <div className="border border-border rounded-lg p-4 space-y-4">
      {/* 折叠标题 */}
      <div 
        className="flex items-center justify-between cursor-pointer hover:bg-muted/50 rounded-md p-2 -m-2 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
          <Label className="text-sm font-medium text-foreground cursor-pointer">{title}</Label>
        </div>
        <div className="text-xs text-muted-foreground">
          {isExpanded ? "收起" : "展开"}
        </div>
      </div>

      {/* 折叠内容 */}
      {isExpanded && (
        <div className="space-y-4 pt-2">
          {/* Streaming Output */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="space-y-1">
              <Label className="text-sm font-medium text-foreground">启用流式输出</Label>
              <p className="text-xs text-muted-foreground">启用流式输出时实时显示响应，禁用后仅显示完整响应。</p>
            </div>
            <Switch 
              checked={config.streamingEnabled} 
              onCheckedChange={(checked) => updateConfig({ streamingEnabled: checked })} 
            />
          </div>

          {/* Temperature */}
          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Label className="text-sm font-medium text-foreground">创意活跃度</Label>
                <span className="text-xs text-muted-foreground">temperature</span>
              </div>
              <p className="text-xs text-muted-foreground">数值越大，回答越有创意和想象力；数值越小，回答越严谨</p>
            </div>
            <div className="flex items-center gap-4">
              <Slider 
                value={config.temperature} 
                onValueChange={(value) => updateConfig({ temperature: value })} 
                max={2} 
                min={0} 
                step={0.1} 
                className="flex-1" 
              />
              <span className="text-sm font-medium text-foreground w-12 text-right">{config.temperature[0].toFixed(1)}</span>
            </div>
          </div>

          {/* Top P */}
          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Label className="text-sm font-medium text-foreground">思维开放度</Label>
                <span className="text-xs text-muted-foreground">top_p</span>
              </div>
              <p className="text-xs text-muted-foreground">
                考虑多少种可能性，值越大，接受更多可能的回答；值越小，倾向选择最可能的回答，不推荐和创意活跃度一起更改
              </p>
            </div>
            <div className="flex items-center gap-4">
              <Slider 
                value={config.topP} 
                onValueChange={(value) => updateConfig({ topP: value })} 
                max={1} 
                min={0} 
                step={0.1} 
                className="flex-1" 
              />
              <span className="text-sm font-medium text-foreground w-12 text-right">{config.topP[0].toFixed(1)}</span>
            </div>
          </div>

          {/* Presence Penalty */}
          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Label className="text-sm font-medium text-foreground">表达发散度</Label>
                <span className="text-xs text-muted-foreground">presence_penalty</span>
              </div>
              <p className="text-xs text-muted-foreground">
                值越大，越倾向不同的表达方式，避免概念重复；值越小，越倾向使用重复的概念或表达，表达更具一致性
              </p>
            </div>
            <div className="flex items-center gap-4">
              <Slider
                value={config.presencePenalty}
                onValueChange={(value) => updateConfig({ presencePenalty: value })}
                max={2}
                min={-2}
                step={0.1}
                className="flex-1"
              />
              <span className="text-sm font-medium text-foreground w-12 text-right">{config.presencePenalty[0].toFixed(1)}</span>
            </div>
          </div>

          {/* Frequency Penalty */}
          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Label className="text-sm font-medium text-foreground">词汇丰富度</Label>
                <span className="text-xs text-muted-foreground">frequency_penalty</span>
              </div>
              <p className="text-xs text-muted-foreground">值越大，再词频率越多样化；值越低，用词更有实际性</p>
            </div>
            <div className="flex items-center gap-4">
              <Slider
                value={config.frequencyPenalty}
                onValueChange={(value) => updateConfig({ frequencyPenalty: value })}
                max={2}
                min={-2}
                step={0.1}
                className="flex-1"
              />
              <span className="text-sm font-medium text-foreground w-12 text-right">
                {config.frequencyPenalty[0].toFixed(1)}
              </span>
            </div>
          </div>

          <div className="space-y-6 pt-4">
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <Label className="text-sm font-medium text-foreground">开启单次回复限制</Label>
                <Switch 
                  checked={config.singleResponseLimit} 
                  onCheckedChange={(checked) => updateConfig({ singleResponseLimit: checked })} 
                />
              </div>

              {config.singleResponseLimit && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Label className="text-sm font-medium text-foreground">单次回复限制</Label>
                      <span className="text-xs text-muted-foreground">max_tokens</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <Slider
                        value={config.maxTokens}
                        onValueChange={handleMaxTokensSliderChange}
                        max={32000}
                        min={0}
                        step={100}
                        className="w-48 md:w-64"
                      />
                      <div className="relative group">
                        <Input
                          type="text"
                          value={config.maxTokensInput}
                          onChange={handleMaxTokensInputChange}
                          className="w-20 h-8 text-center text-sm pr-5"
                        />
                        <div className="absolute right-0 top-0 h-full flex flex-col justify-center items-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          <button
                            onClick={incrementTokens}
                            className="h-1/2 px-1 text-muted-foreground hover:text-foreground flex items-center"
                            aria-label="增加"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6"/></svg>
                          </button>
                          <button
                            onClick={decrementTokens}
                            className="h-1/2 px-1 text-muted-foreground hover:text-foreground flex items-center"
                            aria-label="减少"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">单次交互所用的最大 Token 数</p>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <Label className="text-sm font-medium text-foreground">开启推理强度调整</Label>
                <Switch 
                  checked={config.intelligentAdjustment} 
                  onCheckedChange={(checked) => updateConfig({ intelligentAdjustment: checked })} 
                />
              </div>

              {config.intelligentAdjustment && (
                <div className="space-y-3">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <Label className="text-sm font-medium text-foreground">推理强度</Label>
                        <span className="text-xs text-muted-foreground">reasoning_effort</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        值越大，推理能力越强，但可能会增加响应时间和 Token 消耗
                      </p>
                    </div>
                    <Select 
                      value={config.reasoningEffort} 
                      onValueChange={(value) => updateConfig({ reasoningEffort: value })}
                    >
                      <SelectTrigger className="w-full md:w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="低">低</SelectItem>
                        <SelectItem value="中">中</SelectItem>
                        <SelectItem value="高">高</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}