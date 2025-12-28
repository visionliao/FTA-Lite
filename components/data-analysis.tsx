"use client"

import { useState, useEffect, useRef } from "react"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { BarChart3, Camera, CheckCircle, AlertCircle, Loader2 } from "lucide-react"
import { useScreenshot } from "@/hooks/useScreenshot"

interface QuestionResult {
  id: number
  question: string
  standardAnswer: string
  modelAnswer: string
  maxScore: number
  score: number
  workModel: string // 工作模型
  workTokenUsage: number
  workDurationUsage: number
  scoreModel: string // 评分模型
  scoreTokenUsage: number
  scoreDurationUsage: number
  dbQueryDuration?: number // 查询向量数据库耗时
  rerankDuration?: number // 重排序耗时
  databaseName?: string // 数据库名称
  embeddingModelName?: string // 嵌入模型名称
  rerankModelName?: string // 重排序模型名称
  loop?: string // 用于标识来自哪个轮次
  // 全部选项时使用的字段（所有轮次的总和）
  totalWorkTokenUsage?: number
  totalWorkDurationUsage?: number
  totalScoreTokenUsage?: number
  totalScoreDurationUsage?: number
  totalDbQueryDuration?: number // 所有轮次的查询数据库耗时总和
  totalRerankDuration?: number // 所有轮次的重排序耗时总和
  // 全部选项时使用的字段（得分计算）
  totalActualScore?: number // 所有轮次该问题的实际得分之和
  totalMaxScore?: number // 所有轮次该问题的分数之和
}

interface LoopResult {
  loopId: string
  results: QuestionResult[]
  averageScore: number
  totalScore: number
  maxPossibleScore: number // 问题总分（所有问题的maxScore相加）
  totalTokenUsage: number
  averageDuration: number
  averageDbQueryDuration?: number // 查询向量数据库平均耗时
  averageRerankDuration?: number // 重排序平均耗时
}

export function DataAnalysis() {
  const [directories, setDirectories] = useState<string[]>([])
  const [selectedDirectory, setSelectedDirectory] = useState<string>("")
  const [loops, setLoops] = useState<string[]>([])
  const [selectedLoop, setSelectedLoop] = useState<string>("1")
  const [loopResults, setLoopResults] = useState<LoopResult | null>(null)
  const [summaryStats, setSummaryStats] = useState<{
    averageScore: number
    totalTokenUsage: number
    averageDuration: number
    totalQuestions: number
    averageDbQueryDuration?: number
    averageRerankDuration?: number
  } | null>(null)

  // 截图相关状态
  const reportRef = useRef<HTMLDivElement>(null)
  const { captureScreenshot, isCapturing: isCapturingScreenshot, error: screenshotError } = useScreenshot()

  // 弹窗相关状态
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [showSuccessDialog, setShowSuccessDialog] = useState(false)
  const [showErrorDialog, setShowErrorDialog] = useState(false)
  const [dialogMessage, setDialogMessage] = useState("")
  const [pendingQuestionId, setPendingQuestionId] = useState<number | null>(null)
  const [pendingModelAnswer, setPendingModelAnswer] = useState<string>("")
  const [isUpdating, setIsUpdating] = useState(false)

  // 加载结果目录
  useEffect(() => {
    loadDirectories()
  }, [])

  const loadDirectories = async () => {
    try {
      const response = await fetch("/api/analyze-results")
      const data = await response.json()
      if (data.success) {
        setDirectories(data.directories)
        if (data.directories.length > 0) {
          // 按时间排序，最新的在前面
          const sortedDirs = [...data.directories].sort().reverse()
          setSelectedDirectory(sortedDirs[0])
        }
      }
    } catch (error) {
      console.error("Failed to load directories:", error)
    }
  }

  // 当选择目录变化时，加载循环次数并重置为第1轮
  useEffect(() => {
    if (selectedDirectory) {
      loadLoops()
    }
  }, [selectedDirectory])

  // 当目录或循环变化时，自动分析数据
  useEffect(() => {
    if (selectedDirectory && selectedLoop) {
      analyzeResults()
    }
  }, [selectedDirectory, selectedLoop])

  const loadLoops = async () => {
    try {
      const response = await fetch("/api/analyze-results", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          directory: selectedDirectory,
          getLoops: true
        })
      })

      const data = await response.json()
      if (data.success && data.loops) {
        setLoops(data.loops.sort((a: string, b: string) => parseInt(a) - parseInt(b)))
        if (data.loops.length > 0) {
          setSelectedLoop("all") // 默认选中全部
        }
      }
    } catch (error) {
      console.error("Failed to load loops:", error)
    }
  }

  const analyzeResults = async () => {
    if (!selectedDirectory || !selectedLoop) return

    try {
      const response = await fetch("/api/analyze-results", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          directory: selectedDirectory,
          loop: selectedLoop
        })
      })

      const data = await response.json()
      if (data.success && data.results) {
        let processedResults: QuestionResult[]
        let totalScore: number
        let maxPossibleScore: number
        let averageScore: number
        let totalTokenUsage: number
        let averageDuration: number
        let averageDbQueryDuration: number
        let averageRerankDuration: number

        if (data.isAllLoops) {
          // 处理全部轮次的数据
          const resultsByQuestion = new Map<number, QuestionResult[]>()

          // 按问题ID分组
          data.results.forEach((result: QuestionResult) => {
            if (!resultsByQuestion.has(result.id)) {
              resultsByQuestion.set(result.id, [])
            }
            resultsByQuestion.get(result.id)?.push(result)
          })

          // 处理每个问题：选择得分最低的回答，计算平均分和性能指标总和
          processedResults = []
          for (const [questionId, questionResults] of resultsByQuestion) {
            // 找到得分最低的结果
            const minScoreResult = questionResults.reduce((min, current) =>
              current.score < min.score ? current : min
            )

            // 计算平均分
            const averageScoreForQuestion = questionResults.reduce((sum, r) => sum + r.score, 0) / questionResults.length

            // 计算性能指标的总和（所有轮次）
            const totalWorkTokenUsage = questionResults.reduce((sum, r) => sum + r.workTokenUsage, 0)
            const totalWorkDurationUsage = questionResults.reduce((sum, r) => sum + r.workDurationUsage, 0)
            const totalScoreTokenUsage = questionResults.reduce((sum, r) => sum + r.scoreTokenUsage, 0)
            const totalScoreDurationUsage = questionResults.reduce((sum, r) => sum + r.scoreDurationUsage, 0)
            const totalDbQueryDuration = questionResults.reduce((sum, r) => sum + (r.dbQueryDuration || 0), 0)
            const totalRerankDuration = questionResults.reduce((sum, r) => sum + (r.rerankDuration || 0), 0)

            // 计算得分情况（所有轮次）
            const totalActualScore = questionResults.reduce((sum, r) => sum + r.score, 0)
            const totalMaxScore = questionResults.reduce((sum, r) => sum + r.maxScore, 0)

            // 创建处理后的结果
            processedResults.push({
              ...minScoreResult,
              score: averageScoreForQuestion, // 使用平均分（用于排序和颜色显示）
              totalWorkTokenUsage, // 所有轮次的问答消耗token总和
              totalWorkDurationUsage, // 所有轮次的问答耗时总和
              totalScoreTokenUsage, // 所有轮次的评分消耗token总和
              totalScoreDurationUsage, // 所有轮次的评分耗时总和
              totalDbQueryDuration, // 所有轮次的查询数据库耗时总和
              totalRerankDuration, // 所有轮次的重排序耗时总和
              totalActualScore, // 所有轮次该问题的实际得分之和
              totalMaxScore // 所有轮次该问题的分数之和
            })
          }

          // 计算总体统计数据
          totalScore = data.results.reduce((sum: number, r: QuestionResult) => sum + r.score, 0)
          maxPossibleScore = data.results.reduce((sum: number, r: QuestionResult) => sum + r.maxScore, 0)
          averageScore = totalScore / data.results.length
          totalTokenUsage = data.results.reduce((sum: number, r: QuestionResult) => sum + r.workTokenUsage + r.scoreTokenUsage, 0)
          averageDuration = data.results.reduce((sum: number, r: QuestionResult) => sum + r.workDurationUsage + r.scoreDurationUsage, 0) / data.results.length
          averageDbQueryDuration = data.results.reduce((sum: number, r: QuestionResult) => sum + (r.dbQueryDuration || 0), 0) / data.results.length
          averageRerankDuration = data.results.reduce((sum: number, r: QuestionResult) => sum + (r.rerankDuration || 0), 0) / data.results.length
        } else {
          // 处理单个轮次的数据（保持原有逻辑）
          processedResults = data.results
          totalScore = processedResults.reduce((sum: number, r: QuestionResult) => sum + r.score, 0)
          maxPossibleScore = processedResults.reduce((sum: number, r: QuestionResult) => sum + r.maxScore, 0)
          averageScore = totalScore / processedResults.length
          totalTokenUsage = processedResults.reduce((sum: number, r: QuestionResult) => sum + r.workTokenUsage + r.scoreTokenUsage, 0)
          averageDuration = processedResults.reduce((sum: number, r: QuestionResult) => sum + r.workDurationUsage + r.scoreDurationUsage, 0) / processedResults.length
          averageDbQueryDuration = processedResults.reduce((sum: number, r: QuestionResult) => sum + (r.dbQueryDuration || 0), 0) / processedResults.length
          averageRerankDuration = processedResults.reduce((sum: number, r: QuestionResult) => sum + (r.rerankDuration || 0), 0) / processedResults.length
        }

        setLoopResults({
          loopId: selectedLoop,
          results: processedResults,
          averageScore,
          totalScore,
          maxPossibleScore,
          totalTokenUsage,
          averageDuration,
          averageDbQueryDuration,
          averageRerankDuration
        })

        setSummaryStats({
          averageScore,
          totalTokenUsage,
          averageDuration,
          averageDbQueryDuration,
          averageRerankDuration,
          totalQuestions: processedResults.length
        })
      }
    } catch (error) {
      console.error("Failed to analyze results:", error)
    }
  }

  // 截图处理函数
  const handleScreenshot = async () => {
    if (!reportRef.current || !selectedDirectory || !selectedLoop) {
      console.error("Missing required data for screenshot")
      return
    }

    try {
      // 生成文件名格式: 测试的日期时间_测试轮次.png
      const cleanDirectory = selectedDirectory.replace(/[:.]/g, '-')
      const filename = `${cleanDirectory}_${selectedLoop === 'all' ? 'all' : selectedLoop}.png`

      await captureScreenshot(reportRef.current, {
        filename,
        quality: 0.95,
        scale: 2,
        backgroundColor: '#ffffff',
        saveToServer: true,
        serverDirectory: 'output/reports'
      })
    } catch (error) {
      console.error("Failed to capture screenshot:", error)
      alert("截图保存失败，请重试")
    }
  }

  // 处理"设为标准答案"按钮点击 - 显示确认对话框
  const handleSetAsStandardAnswer = (questionId: number, modelAnswer: string) => {
    if (!selectedDirectory || !selectedLoop) {
      setDialogMessage("无法获取测试信息")
      setShowErrorDialog(true)
      return
    }

    setPendingQuestionId(questionId)
    setPendingModelAnswer(modelAnswer)
    setShowConfirmDialog(true)
  }

  // 确认更新标准答案
  const confirmUpdateStandardAnswer = async () => {
    if (pendingQuestionId === null || !pendingModelAnswer) return

    setIsUpdating(true)
    setShowConfirmDialog(false)

    try {
      const response = await fetch("/api/update-standard-answer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          questionId: pendingQuestionId,
          modelAnswer: pendingModelAnswer,
          loop: selectedLoop,
          directory: selectedDirectory
        })
      })

      const data = await response.json()

      if (data.success) {
        setDialogMessage(`问题 #${pendingQuestionId} 的标准答案已更新，分数已设置为 ${data.maxScore} 分。`)
        setShowSuccessDialog(true)
        // 重新加载当前数据
        await analyzeResults()
      } else {
        setDialogMessage(data.error || "更新标准答案失败")
        setShowErrorDialog(true)
      }
    } catch (error) {
      console.error("Failed to set standard answer:", error)
      setDialogMessage("更新标准答案失败，请重试")
      setShowErrorDialog(true)
    } finally {
      setIsUpdating(false)
      setPendingQuestionId(null)
      setPendingModelAnswer("")
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 8) return "bg-green-100 border-green-300"
    if (score >= 6) return "bg-yellow-100 border-yellow-300"
    return "bg-red-100 border-red-300"
  }

  const getScoreTextColor = (score: number) => {
    if (score >= 8) return "text-green-800 bg-green-200"
    if (score >= 6) return "text-yellow-800 bg-yellow-200"
    return "text-red-800 bg-red-200"
  }

  const formatDuration = (ms: number) => {
    return `${(ms / 1000).toFixed(2)}s`
  }

  const formatDurationMs = (ms: number) => {
    return `${ms.toFixed(2)}ms`
  }

  const formatToken = (token: number) => {
    return token.toLocaleString()
  }

  return (
    <div ref={reportRef} className="p-4 md:p-8 max-w-full md:max-w-4xl lg:max-w-5xl xl:max-w-6xl mx-auto">
      <div className="mb-6 border-b border-border pb-4 md:mb-8">
        <h1 className="text-xl font-semibold text-foreground md:text-2xl">测试报告</h1>
      </div>

      <div className="space-y-6">
        {/* 分析控制 */}
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex flex-col md:flex-row md:items-center gap-2 flex-1">
              <div>
                <Label className="text-sm font-medium text-foreground">选择测试结果</Label>
                <Select value={selectedDirectory} onValueChange={setSelectedDirectory}>
                  <SelectTrigger className="w-full md:w-64 disabled:opacity-50">
                    <SelectValue placeholder="选择测试结果" />
                  </SelectTrigger>
                  <SelectContent>
                    {directories.map((dir) => (
                      <SelectItem key={dir} value={dir}>
                        {dir}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {loops.length > 0 && (
                <div>
                  <Label className="text-sm font-medium text-foreground">测试轮次</Label>
                  <Select value={selectedLoop} onValueChange={setSelectedLoop}>
                    <SelectTrigger className="w-full md:w-40 disabled:opacity-50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem key="all" value="all">
                        全部
                      </SelectItem>
                      {loops.map((loop) => (
                        <SelectItem key={loop} value={loop}>
                          第 {loop} 轮
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            
            {/* 截图按钮 */}
            {loopResults && (
              <Button
                onClick={handleScreenshot}
                disabled={isCapturingScreenshot}
                variant="outline"
                className="flex items-center gap-2 flex-shrink-0 min-w-[120px]"
              >
                <Camera className="h-4 w-4" />
                {isCapturingScreenshot ? "截图中..." : "截图保存"}
              </Button>
            )}
          </div>
        </div>

        {/* 分析结果 */}
        {summaryStats && (
        <>
          <div className="space-y-6">
            {/* 最后一行：总体统计 */}
            {loopResults && (
              <div className="border-b pb-4 mb-4">
                <div className="grid grid-cols-1 md:grid-cols-7 gap-4 text-sm bg-muted/30 p-4 rounded-lg">
                  <div className="text-center">
                    <p className="font-medium text-muted-foreground">问题总分</p>
                    <p className="text-lg font-bold text-blue-600">{loopResults.maxPossibleScore}</p>
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-muted-foreground">总得分</p>
                    <p className="text-lg font-bold text-green-600">{loopResults.totalScore}</p>
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-muted-foreground">平均得分</p>
                    <p className="text-lg font-bold text-primary">{loopResults.averageScore.toFixed(2)}</p>
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-muted-foreground">总token消耗</p>
                    <p className="text-lg font-bold text-green-600">{formatToken(loopResults.totalTokenUsage)}</p>
                    <p className="text-xs text-green-500 mt-1 truncate max-w-full" title={loopResults.results[0]?.workModel}>
                      {loopResults.results[0]?.workModel || "N/A"}
                    </p>
                    <p className="text-xs text-green-500 mt-1 truncate max-w-full" title={loopResults.results[0]?.scoreModel}>
                      {loopResults.results[0]?.scoreModel || "N/A"}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-muted-foreground">查询平均耗时</p>
                    <p className="text-lg font-bold text-orange-600">
                      {formatDurationMs(loopResults.averageDbQueryDuration || 0)}
                    </p>
                    <p className="text-xs text-orange-500 mt-1">
                      {loopResults.results[0]?.databaseName || "N/A"}
                    </p>
                    <p className="text-xs text-orange-500 truncate max-w-full" title={loopResults.results[0]?.embeddingModelName}>
                      {loopResults.results[0]?.embeddingModelName || "N/A"}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-muted-foreground">重排序平均耗时</p>
                    <p className="text-lg font-bold text-pink-600">
                      {formatDurationMs(loopResults.averageRerankDuration || 0)}
                    </p>
                    <p className="text-xs text-pink-500 mt-1 truncate max-w-full" title={loopResults.results[0]?.rerankModelName}>
                      {loopResults.results[0]?.rerankModelName || "N/A"}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-muted-foreground">总共耗时</p>
                    <p className="text-lg font-bold text-purple-600">
                      {formatDuration(loopResults.results.reduce((sum, r) => sum + r.workDurationUsage + r.scoreDurationUsage, 0))}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {[...loopResults?.results || []]
                .sort((a, b) => {
                  // 红色背景（<6分）最前，黄色背景（6-7.9分）中间，绿色背景（≥8分）最后
                  if (a.score < 6 && b.score >= 6) return -1
                  if (a.score >= 6 && b.score < 6) return 1
                  if (a.score >= 6 && a.score < 8 && b.score >= 8) return -1
                  if (a.score >= 8 && b.score < 8) return 1
                  return 0
                })
                .map((result) => (
              <div key={result.id} className={`border rounded-lg p-4 ${getScoreColor(result.score)}`}>
                {/* 第一行：问题编号和得分 */}
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium">问题 #{result.id}</h3>
                  <span className={`px-2 py-1 rounded text-sm font-medium ${getScoreTextColor(result.score)}`}>
                    得分: {
                      selectedLoop === 'all'
                        ? `${result.totalActualScore}/${result.totalMaxScore}`
                        : `${result.score}/${result.maxScore}`
                    }
                    {selectedLoop === 'all' && (
                      <span className="text-xs text-gray-500 ml-1">(累计)</span>
                    )}
                  </span>
                </div>

                {/* 第二行：问题内容 */}
                <div className="mb-2">
                  <span className="font-medium text-muted-foreground mr-2">问题：</span>
                  <span className="text-sm bg-white/50 px-2 py-1 rounded">{result.question}</span>
                </div>

                {/* 第三行：标准答案 */}
                <div className="mb-2">
                  <span className="font-medium text-muted-foreground mr-2">标准答案：</span>
                  <span className="text-sm bg-white/50 px-2 py-1 rounded">{result.standardAnswer}</span>
                </div>

                {/* 第四行：模型回答 */}
                <div className="mb-2">
                  <span className="font-medium text-muted-foreground mr-2">模型回答：</span>
                  <span className="text-sm bg-white/50 px-2 py-1 rounded">{result.modelAnswer}</span>
                </div>

                {/* 第五行：性能指标 */}
                <div className="flex flex-wrap gap-3 text-sm">
                  <div className="bg-blue-50 px-3 py-1 rounded">
                    <span className="text-xs text-blue-600 font-medium">问答消耗token：</span>
                    <span className="text-sm ml-1">
                      {formatToken(
                        selectedLoop === 'all'
                          ? result.totalWorkTokenUsage || 0
                          : result.workTokenUsage
                      )}
                      {selectedLoop === 'all' && (
                        <span className="text-xs text-gray-500 ml-1">(累计)</span>
                      )}
                    </span>
                  </div>
                  <div className="bg-purple-50 px-3 py-1 rounded">
                    <span className="text-xs text-purple-600 font-medium">问答耗时：</span>
                    <span className="text-sm ml-1">
                      {formatDuration(
                        selectedLoop === 'all'
                          ? result.totalWorkDurationUsage || 0
                          : result.workDurationUsage
                      )}
                      {selectedLoop === 'all' && (
                        <span className="text-xs text-gray-500 ml-1">(累计)</span>
                      )}
                    </span>
                  </div>
                  <div className="bg-green-50 px-3 py-1 rounded">
                    <span className="text-xs text-green-600 font-medium">评分消耗token：</span>
                    <span className="text-sm ml-1">
                      {formatToken(
                        selectedLoop === 'all'
                          ? result.totalScoreTokenUsage || 0
                          : result.scoreTokenUsage
                      )}
                      {selectedLoop === 'all' && (
                        <span className="text-xs text-gray-500 ml-1">(累计)</span>
                      )}
                    </span>
                  </div>
                  <div className="bg-orange-50 px-3 py-1 rounded">
                    <span className="text-xs text-orange-600 font-medium">评分耗时：</span>
                    <span className="text-sm ml-1">
                      {formatDuration(
                        selectedLoop === 'all'
                          ? result.totalScoreDurationUsage || 0
                          : result.scoreDurationUsage
                      )}
                      {selectedLoop === 'all' && (
                        <span className="text-xs text-gray-500 ml-1">(累计)</span>
                      )}
                    </span>
                  </div>
                  {(result.dbQueryDuration !== undefined || result.totalDbQueryDuration !== undefined) && (
                    <div className="bg-amber-50 px-3 py-1 rounded">
                      <span className="text-xs text-amber-600 font-medium">查询耗时：</span>
                      <span className="text-sm ml-1">
                        {formatDurationMs(
                          selectedLoop === 'all'
                            ? result.totalDbQueryDuration || 0
                            : result.dbQueryDuration || 0
                        )}
                        {selectedLoop === 'all' && (
                          <span className="text-xs text-gray-500 ml-1">(累计)</span>
                        )}
                      </span>
                    </div>
                  )}
                  {(result.rerankDuration !== undefined || result.totalRerankDuration !== undefined) && (
                    <div className="bg-rose-50 px-3 py-1 rounded">
                      <span className="text-xs text-rose-600 font-medium">重排序耗时：</span>
                      <span className="text-sm ml-1">
                        {formatDurationMs(
                          selectedLoop === 'all'
                            ? result.totalRerankDuration || 0
                            : result.rerankDuration || 0
                        )}
                        {selectedLoop === 'all' && (
                          <span className="text-xs text-gray-500 ml-1">(累计)</span>
                        )}
                      </span>
                    </div>
                  )}
                </div>

                {/* 第六行：操作按钮 */}
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-black/10">
                  <div></div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-7 px-3"
                    onClick={() => handleSetAsStandardAnswer(result.id, result.modelAnswer)}
                  >
                    设为标准答案
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </>
        )}

        {/* 空状态 */}
        {!summaryStats && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg text-muted-foreground mb-2">暂无分析数据</p>
              <p className="text-sm text-muted-foreground">请选择测试结果和轮次</p>
            </CardContent>
          </Card>
        )}

        {/* 确认对话框 */}
        <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-amber-500" />
                确认设置标准答案
              </DialogTitle>
              <DialogDescription>
                确定要将此模型回答设为问题 #{pendingQuestionId} 的标准答案吗？
              </DialogDescription>
            </DialogHeader>
            <div className="text-sm text-muted-foreground">
              这将更新测试题集文件和测试结果中的分数。
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowConfirmDialog(false)} disabled={isUpdating}>
                取消
              </Button>
              <Button onClick={confirmUpdateStandardAnswer} disabled={isUpdating}>
                {isUpdating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    更新中...
                  </>
                ) : (
                  "确认"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 成功对话框 */}
        <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                操作成功
              </DialogTitle>
            </DialogHeader>
            <div className="text-sm text-muted-foreground">
              {dialogMessage}
            </div>
            <DialogFooter>
              <Button onClick={() => setShowSuccessDialog(false)}>
                我知道了
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 错误对话框 */}
        <Dialog open={showErrorDialog} onOpenChange={setShowErrorDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-500" />
                操作失败
              </DialogTitle>
            </DialogHeader>
            <div className="text-sm text-muted-foreground">
              {dialogMessage}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowErrorDialog(false)}>
                关闭
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}