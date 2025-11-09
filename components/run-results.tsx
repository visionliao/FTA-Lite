"use client"

import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { useAppStore } from "@/store/app-store"
import { useState, useEffect, useRef } from "react"
import { AlertTriangle, Cog, FileText, Bot, HelpCircle, Star } from "lucide-react"

export function RunResults() {
  const [testCases, setTestCases] = useState<any[]>([])
  const [testCasesCount, setTestCasesCount] = useState(0)
  const [showValidationDialog, setShowValidationDialog] = useState(false)
  const [validationMessage, setValidationMessage] = useState("")
  const [totalTokenUsage, setTotalTokenUsage] = useState(0)

  // 使用全局 AbortController 引用，确保在组件重新挂载时能访问到同一个 controller
  // 这样切换面板后，停止运行按钮还能正常工作
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // 如果全局没有 AbortController，创建一个
    if (!(window as any).globalAbortController) {
      (window as any).globalAbortController = null;
    }

    // 组件挂载时，将全局 controller 引用保存到本地 ref
    abortControllerRef.current = (window as any).globalAbortController;

    // 组件卸载时，不清除全局 controller，只清除本地引用
    return () => {
      // 不清除全局 controller，让其他组件实例可以访问
      abortControllerRef.current = null;
    };
  }, []);

  const {
    runResultsConfig: {
      runStatus,
      testLoopCount,
      totalTestScore,
      // 进度状态
      currentTask,
      totalTasks,
      progress,
      isExecuting,
      // isCancelled 在这个新方案中前端不需要直接读取，
      // 停止是通过断开连接和设置 isExecuting 实现的
      activeTaskMessage,
      currentRunState
    },
    projectConfig,
    modelSettingsConfig,
    startRun,
    stopRun,
    setRunError,
    setActiveTaskMessage,
    setTestLoopCount,
    setTotalTestScore,
    setCurrentTask,
    setTotalTasks,
    setProgress,
    setIsExecuting,
    setIsCancelled, // 用于手动停止时设置
    updateCurrentRunState,
    clearCurrentRunState
  } = useAppStore()

  // 加载测试题集数据
  useEffect(() => {
    const loadTestCases = async () => {
      try {
        const response = await fetch("/api/test-cases")
        if (response.ok) {
          const data = await response.json()
          setTestCases(data.checks) // 存储完整的测试用例
          setTestCasesCount(data.checks.length)

          // 计算总分
          const totalScore = data.checks.reduce((sum: number, question: any) => sum + (question.score || 0), 0)
          setTotalTestScore(totalScore)
        }
      } catch (error) {
        console.error("Failed to load test cases:", error)
      }
    }

    loadTestCases()
  }, [setTotalTestScore])

  // 组件挂载时检查是否已有任务在运行
  useEffect(() => {
    // 如果 store 显示正在执行，但本组件没有 controller，说明是重新挂载的情况
    if (isExecuting && !abortControllerRef.current) {
      console.log("Detected re-mount while task is running. Task continues in background.");
      setActiveTaskMessage("任务在后台运行中。您可以切换到其他面板，任务会继续执行。");
    }
  }, [isExecuting]);

  // 组件卸载时不要清理 EventSource，允许用户切换面板后任务继续运行
  useEffect(() => {
    return () => {
      // 注意：这里不 abort controller，允许任务在后台继续运行
      // if (abortControllerRef.current) {
      //   abortControllerRef.current.abort();
      // }
      console.log("RunResults component unmounting, but task continues running in background");
    };
  }, []);

  // 计算总任务数
  const calculateTotalTasks = () => {
    // 基础任务 = (问答(Q) + 评分(Q)) * F
    const baseTasks = testCasesCount * 2;

    return baseTasks * testLoopCount;
  }

  // 验证运行条件
  const validateRunConditions = () => {
    const errors = []
    if (!modelSettingsConfig.workModel) errors.push("请选择工作模型")
    if (!modelSettingsConfig.scoreModel) errors.push("请选择评分模型")
    if (testCasesCount === 0) errors.push("请配置测试题集")
    return errors
  }

  // 处理运行按钮点击
  const handleRunClick = () => {
    const errors = validateRunConditions()
    if (errors.length > 0) {
      setValidationMessage(errors.join("\n"))
      setShowValidationDialog(true)
      return
    }
    // 重置token消耗计数
    setTotalTokenUsage(0)
    handleRun()
  }

  // 处理停止运行
  const handleStopClick = () => {
    console.log("Stopping run...");
    setIsCancelled(true); // 设置 store 中的标志

    // 通过 AbortController 取消正在进行的 fetch 请求
    if (abortControllerRef.current) {
      abortControllerRef.current.abort(); // 传递到后端的abort事件
    }

    stopRun();
    setIsExecuting(false);
    setActiveTaskMessage("任务已被用户手动取消。");
  }

  // 主运行函数
  const handleRun = async () => {
    console.log("=== 开始运行工厂测试任务 ===")
    if (isExecuting) return;

    // --- 1. 状态初始化 ---
    setIsCancelled(false);
    setIsExecuting(true);
    startRun();
    clearCurrentRunState(); // 清空上次的覆盖显示内容
    setActiveTaskMessage("任务初始化...");

    const calculatedTotalTasks = calculateTotalTasks();
    setTotalTasks(calculatedTotalTasks);
    setCurrentTask(0);
    setProgress(0);

    // 检查是否已经有任务在运行
    if ((window as any).globalAbortController) {
      console.log("Global AbortController already exists. Task is running in background.");
      setActiveTaskMessage("检测到任务正在后台运行中。停止按钮可正常使用，但无法启动新任务。");
      return; // 不启动新任务，但允许停止现有任务
    }

    // 创建 AbortController
    const controller = new AbortController();
    abortControllerRef.current = controller;

    // 保存到全局引用，确保切换面板后还能访问到同一个 controller
    (window as any).globalAbortController = controller;
    console.log("Created new global AbortController");

    // --- 2. 准备配置 ---
    const config = {
      project: projectConfig,
      // 确保转换为数组
      models: {
        work: modelSettingsConfig.workModel,
        score: modelSettingsConfig.scoreModel,
        // 包含模型参数
        workParams: modelSettingsConfig.workModelParams,
        scoreParams: modelSettingsConfig.scoreModelParams
      },
      testCases: testCases, // 发送完整的测试用例数据
      testConfig: {
        loopCount: testLoopCount,
      },
    };

    try {
      // --- 3. 使用 fetch 发起 POST 请求 ---
      const response = await fetch('/api/run-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
        signal: controller.signal // 关联 AbortController
      });

      if (!response.ok) {
        throw new Error(`服务器响应错误: ${response.status} ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error("响应体为空");
      }

      setActiveTaskMessage("已连接到服务器，任务开始执行...");

      // --- 4. 手动处理流式响应 ---
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          console.log("Stream finished.");
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || ""; // 保留最后一个不完整的消息

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const jsonStr = line.substring(6);
            const data = JSON.parse(jsonStr);

            switch (data.type) {
              case 'log':
                console.log("[Server Log]:", data.message);
                break;
              case 'update':
                if (data.payload.activeTaskMessage) setActiveTaskMessage(data.payload.activeTaskMessage);
                if (data.payload.progress !== undefined) setProgress(data.payload.progress);
                if (data.payload.currentTask !== undefined) setCurrentTask(data.payload.currentTask);
                break;
              case 'state_update':
                updateCurrentRunState(data.payload);
                break;
              case 'token_usage':
                setTotalTokenUsage(data.tokenUsage);
                break;
              case 'done':
                setActiveTaskMessage(data.message);
                stopRun();
                setIsExecuting(false);
                setProgress(100);
                setCurrentTask(totalTasks);
                // 收到 done 消息后，主动 break 循环
                // reader.cancel() 会在 finally 中执行
                return;
              case 'error':
                 throw new Error(data.message);
            }
          }
        }
      }
    } catch (error: any) {
      // 捕获所有错误，包括 fetch 失败、流读取失败和手动取消
      if (error.name === 'AbortError') {
        console.log('Fetch aborted by user.');
      } else {
        console.error("Run failed:", error);
        setRunError(error.message);
        setActiveTaskMessage("任务因发生错误而停止。");
        stopRun();
        setIsExecuting(false);
      }
    } finally {
        abortControllerRef.current = null;
        // 同时清除全局 AbortController，避免残留引用
        (window as any).globalAbortController = null;
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-full md:max-w-4xl lg:max-w-5xl xl:max-w-6xl mx-auto">
      <div className="mb-6 border-b border-border pb-4 md:mb-8">
        <h1 className="text-xl font-semibold text-foreground md:text-2xl">开始运行</h1>
      </div>

      <div className="space-y-6">
        {/* Config Summary */}
        <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
          <div>
            <Label className="text-base font-medium text-foreground">当前配置概览</Label>
            <p className="text-sm text-muted-foreground mt-1">各面板的配置信息</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
            <div>
              <div className="font-medium text-foreground mb-1">项目概况</div>
              <div className="text-muted-foreground">
                项目名: {projectConfig.projectName || "未设置"}
              </div>
              <div className="text-muted-foreground">
                知识库文件: {(projectConfig.knowledgeBaseFiles || []).length} 个
              </div>
              <div className="text-muted-foreground">
                MCP工具: {(projectConfig.mcpTools || []).length} 个
              </div>
            </div>

            <div>
              <div className="font-medium text-foreground mb-1">模型配置</div>
              <div className="text-muted-foreground">
                工作: {modelSettingsConfig.workModel || "未选择"}
              </div>
              <div className="text-muted-foreground">
                评分: {modelSettingsConfig.scoreModel || "未选择"}
              </div>
            </div>

            <div>
              <div className="font-medium text-foreground mb-1">测试题集</div>
              <div className="text-muted-foreground">
                测试题: {testCasesCount} 个
              </div>
              <div className="text-muted-foreground">
                总分: {totalTestScore} 分
              </div>
            </div>
          </div>
        </div>

        {/* Test Configuration */}
        <div className="space-y-6">
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-medium text-foreground">测试循环次数</Label>
                  <span className="text-xs text-muted-foreground">loop_count</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  设置测试循环的次数，范围1-100次
                </p>
              </div>
              <div className="flex items-center gap-4">
                <Slider
                  value={[testLoopCount]}
                  onValueChange={(value) => setTestLoopCount(value[0])}
                  max={100}
                  min={1}
                  step={1}
                  className="w-48 md:w-64"
                />
                <Input
                  type="number"
                  value={testLoopCount}
                  onChange={(e) => {
                    const value = parseInt(e.target.value)
                    if (value >= 1 && value <= 100) {
                      setTestLoopCount(value)
                    }
                  }}
                  className="w-20 h-8 text-center text-sm"
                  min={1}
                  max={100}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Run section */}
        <div className="space-y-4">
          <div className="flex items-center justify-end gap-4">
            {(runStatus?.isRunning || isExecuting) && (
              <div className="flex items-center gap-3 flex-1">
                <div className="flex items-center justify-between text-sm text-muted-foreground w-40">
                  <span>任务进度</span>
                  <span className="font-mono">{currentTask}/{totalTasks}</span>
                </div>
                <div className="flex-1 bg-muted rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
              </div>
            )}
            <Button
              onClick={runStatus?.isRunning || isExecuting ? handleStopClick : handleRunClick}
              className={runStatus?.isRunning || isExecuting
                ? "bg-red-500 hover:bg-red-600 text-white flex-shrink-0"
                : "bg-foreground text-background hover:bg-foreground/90 flex-shrink-0"}
            >
              {runStatus?.isRunning || isExecuting ? "停止运行" : "开始运行"}
            </Button>
          </div>
        </div>

        {/* Results section */}
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <Label className="text-base font-medium text-foreground">运行结果</Label>
              <p className="text-sm text-muted-foreground mt-1">当前正在运行的详细情况</p>
            </div>
            {totalTokenUsage > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-lg border border-border">
                <span className="text-sm text-muted-foreground">Token消耗：</span>
                <span className="text-sm font-medium text-foreground">{totalTokenUsage.toLocaleString()}</span>
              </div>
            )}
          </div>

          {runStatus?.error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="text-red-800 font-medium text-sm">运行错误</div>
              <div className="text-red-600 text-xs mt-1">{runStatus?.error}</div>
            </div>
          )}

          <div className="p-4 border border-border rounded-lg min-h-[300px] flex flex-col text-sm bg-muted/20">
            {/* 只要正在执行，或者有状态数据，就显示内容面板 */}
            {(isExecuting || Object.keys(currentRunState || {}).length > 0) ? (
              <div className="space-y-4 flex-1">
                {/* 1. 当前问答对 (如果有问题) */}
                {currentRunState.questionText && (
                  <div className="p-3 border rounded-md bg-background shadow-sm space-y-3">
                    {/* 问题 */}
                    <div>
                      <div className="flex items-center justify-between font-semibold text-green-700 mb-1 text-xs uppercase tracking-wide">
                        <div className="flex items-center gap-2">
                          <HelpCircle size={14} /> Question #{currentRunState.questionId}
                        </div>
                        <span className="font-mono text-xs text-muted-foreground lowercase">
                          {modelSettingsConfig.workModel}
                        </span>
                      </div>
                      <p className="text-sm p-2 bg-green-50 rounded">{currentRunState.questionText}</p>
                    </div>

                    {/* 回答 (如果有) */}
                    {currentRunState.modelAnswer && (
                      <div className="pt-2 border-t">
                        <div className="flex items-center gap-2 font-semibold text-slate-700 mb-1 text-xs uppercase tracking-wide">
                           <Bot size={14} /> Model Answer
                        </div>
                        <pre className="whitespace-pre-wrap text-xs font-mono p-2 bg-slate-50 rounded max-h-60 overflow-y-auto">
                          {currentRunState.modelAnswer}
                        </pre>
                      </div>
                    )}
                  </div>
                )}

                {/* 2. 评分结果 (如果有) */}
                {currentRunState.score !== undefined && (
                  <div className="p-4 border rounded-md bg-purple-50 flex items-center justify-between animate-in fade-in zoom-in duration-300">
                    <div className="flex items-center gap-2 font-semibold text-purple-700">
                      <Star size={18} /> 当前评分 ({modelSettingsConfig.scoreModel})
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="font-bold text-2xl text-purple-800">{currentRunState.score}</span>
                      <span className="text-sm text-muted-foreground">/ {currentRunState.maxScore}</span>
                    </div>
                  </div>
                )}

              </div>
            ) : (
              // 初始状态或运行结束且无状态时
              <div className="flex-1 flex items-center justify-center text-center font-sans">
                <div>
                  {activeTaskMessage && (activeTaskMessage.includes("成功") || activeTaskMessage.includes("取消") || activeTaskMessage.includes("错误")) ? (
                     <div className={`text-sm font-medium mb-1 ${activeTaskMessage.includes("错误") ? "text-red-600" : "text-green-600"}`}>
                       {activeTaskMessage}
                     </div>
                  ) : null}
                  <div className="text-muted-foreground text-sm">暂无详细结果</div>
                  <div className="text-muted-foreground text-xs mt-1">点击“开始运行”执行任务</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 验证对话框 */}
      <Dialog open={showValidationDialog} onOpenChange={setShowValidationDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
              无法运行
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground whitespace-pre-line">
              {validationMessage}
            </div>
            <DialogFooter>
              <Button onClick={() => setShowValidationDialog(false)}>
                我知道了
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}