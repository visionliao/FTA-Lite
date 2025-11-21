import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// MCP Tool 接口
interface McpTool {
  id: string
  methodName: string
  methodParams: string
  description: string
  returnValue: string
}

// 模型参数接口
interface ModelParams {
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

// 模型配置接口
interface ModelConfig {
  name: string
  provider: string
  color: string
}

interface ProviderConfig {
  apiKey: string
  modelList: string[]
  displayName: string
  color: string
}

// 运行状态接口
interface RunStatus {
  isRunning: boolean
  startTime?: Date
  endTime?: Date
  error?: string
}

// 当前运行任务状态
interface CurrentRunState {
  loop?: number;
  totalLoops?: number;
  questionId?: number;
  questionText?: string;
  modelAnswer?: string;
  score?: number;
  maxScore?: number;
}

// 全局状态接口
interface AppState {
  // UI 状态
  activeSection: string
  sidebarCollapsed: boolean
  isMobile: boolean

  // 项目概况状态
  projectConfig: {
    selectedProject: string
    projectFiles: string[]
    projectName: string
    systemPrompt: string
    knowledgeBaseFiles: string[]
    knowledgeBaseFileData: any[]
    isDragging: boolean
    mcpTools: McpTool[]
    mcpToolsCode: string
    parseError: string
    isLoading: boolean
    isEditMode: boolean
    showSuccess: boolean
    showProjectExistsDialog: boolean
    existingProjectName: string
    // 向量数据库和模型配置
    databaseType: string
    embeddingModel: string
    rerankerModel: string
    googleStoreName: string
  }

  // 模型设置状态
  modelSettingsConfig: {
    models: ModelConfig[]
    providers: { [key: string]: ProviderConfig }
    workModel: string
    scoreModel: string
    workModelParams: ModelParams
    scoreModelParams: ModelParams
  }

  // 运行结果状态
  runResultsConfig: {
    runStatus: RunStatus
    testLoopCount: number
    totalTestScore: number
    // 用于跟踪进度的状态
    currentTask: number
    totalTasks: number
    progress: number
    isExecuting: boolean
    isCancelled: boolean
    activeTaskMessage: string
    currentRunState: CurrentRunState
  }

  // Actions
  // UI Actions
  setActiveSection: (section: string) => void
  setSidebarCollapsed: (collapsed: boolean) => void
  setIsMobile: (mobile: boolean) => void

  // Project Actions
  updateProjectConfig: (config: Partial<AppState['projectConfig']>) => void
  setSelectedProject: (project: string) => void
  setProjectFiles: (files: string[]) => void
  setProjectName: (name: string) => void
  setSystemPrompt: (prompt: string) => void
  setKnowledgeBaseFiles: (files: string[]) => void
  setKnowledgeBaseFileData: (fileData: any[]) => void
  setIsDragging: (dragging: boolean) => void
  setMcpTools: (tools: McpTool[]) => void
  setMcpToolsCode: (code: string) => void
  setParseError: (error: string) => void
  setProjectLoading: (loading: boolean) => void
  setIsEditMode: (edit: boolean) => void
  setShowSuccess: (show: boolean) => void
  setShowProjectExistsDialog: (show: boolean) => void
  setExistingProjectName: (name: string) => void
  setDatabaseType: (type: string) => void
  setEmbeddingModel: (model: string) => void
  setRerankerModel: (model: string) => void
  setGoogleStoreName: (name: string) => void

  // Model Settings Actions
  updateModelSettingsConfig: (config: Partial<AppState['modelSettingsConfig']>) => void
  setModels: (models: ModelConfig[]) => void
  setProviders: (providers: { [key: string]: ProviderConfig }) => void
  setWorkModel: (model: string) => void
  setScoreModel: (model: string) => void
  setWorkModelParams: (params: ModelParams) => void
  setScoreModelParams: (params: ModelParams) => void

  // Run Results Actions
  updateRunResultsConfig: (config: Partial<AppState['runResultsConfig']>) => void
  setRunStatus: (status: RunStatus) => void
  startRun: () => void
  stopRun: () => void
  setRunError: (error: string) => void
  setTestLoopCount: (count: number) => void
  setTotalTestScore: (score: number) => void
  // 用于更新进度的 Actions
  setCurrentTask: (task: number) => void
  setTotalTasks: (tasks: number) => void
  setProgress: (progress: number) => void
  setIsExecuting: (executing: boolean) => void
  setIsCancelled: (cancelled: boolean) => void
  setActiveTaskMessage: (message: string) => void
  updateCurrentRunState: (newState: Partial<CurrentRunState>) => void
  clearCurrentRunState: () => void
}

// 默认模型参数
const defaultModelParams: ModelParams = {
  streamingEnabled: true,
  temperature: [1.0],
  topP: [1.0],
  presencePenalty: [0.0],
  frequencyPenalty: [0.0],
  singleResponseLimit: false,
  maxTokens: [0],
  maxTokensInput: "0",
  intelligentAdjustment: false,
  reasoningEffort: "中"
}

// 创建 Zustand store
export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // UI 状态默认值
      activeSection: "project-overview",
      sidebarCollapsed: false,
      isMobile: false,

      // 项目概况默认值
      projectConfig: {
        selectedProject: "自定义",
        projectFiles: [],
        projectName: "",
        systemPrompt: "",
        knowledgeBaseFiles: [],
        knowledgeBaseFileData: [],
        isDragging: false,
        mcpTools: [],
        mcpToolsCode: "",
        parseError: "",
        isLoading: false,
        isEditMode: true,
        showSuccess: false,
        showProjectExistsDialog: false,
        existingProjectName: "",
        // 向量数据库和模型配置默认值
        databaseType: "POSTGRES",
        embeddingModel: "nomic-embed-text:latest",
        rerankerModel: "BAAI/bge-reranker-v2-m3",
        googleStoreName: ""
      },

      // 模型设置默认值
      modelSettingsConfig: {
        models: [],
        providers: {},
        workModel: "",
        scoreModel: "",
        workModelParams: { ...defaultModelParams },
        scoreModelParams: { ...defaultModelParams }
      },

      // 运行结果默认值
      runResultsConfig: {
        runStatus: {
          isRunning: false
        },
        testLoopCount: 10,
        totalTestScore: 0,
        currentTask: 0,
        totalTasks: 0,
        progress: 0,
        isExecuting: false,
        isCancelled: false,
        activeTaskMessage: "",
        currentRunState: {}
      },

      // UI Actions
      setActiveSection: (section) => set({ activeSection: section }),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      setIsMobile: (mobile) => set({ isMobile: mobile }),

      // Project Actions
      updateProjectConfig: (config) => 
        set((state) => ({ 
          projectConfig: { ...state.projectConfig, ...config } 
        })),

      setSelectedProject: (project) => 
        get().updateProjectConfig({ selectedProject: project }),

      setProjectFiles: (files) => 
        get().updateProjectConfig({ projectFiles: files }),

      setProjectName: (name) => 
        get().updateProjectConfig({ projectName: name }),

      setSystemPrompt: (prompt) =>
        get().updateProjectConfig({ systemPrompt: prompt }),

      setKnowledgeBaseFiles: (files) => 
        get().updateProjectConfig({ knowledgeBaseFiles: files }),

      setKnowledgeBaseFileData: (fileData) =>
        get().updateProjectConfig({ knowledgeBaseFileData: fileData }),

      setIsDragging: (dragging) => 
        get().updateProjectConfig({ isDragging: dragging }),

      setMcpTools: (tools) => 
        get().updateProjectConfig({ mcpTools: tools }),

      setMcpToolsCode: (code) => 
        get().updateProjectConfig({ mcpToolsCode: code }),

      setParseError: (error) => 
        get().updateProjectConfig({ parseError: error }),

      setProjectLoading: (loading) => 
        get().updateProjectConfig({ isLoading: loading }),

      setIsEditMode: (edit) => 
        get().updateProjectConfig({ isEditMode: edit }),

      setShowSuccess: (show) => 
        get().updateProjectConfig({ showSuccess: show }),

      setShowProjectExistsDialog: (show) => 
        get().updateProjectConfig({ showProjectExistsDialog: show }),

      setExistingProjectName: (name) => 
        get().updateProjectConfig({ existingProjectName: name }),

      // Database and Model Configuration Actions
      setDatabaseType: (type: string) =>
        get().updateProjectConfig({ databaseType: type }),

      setEmbeddingModel: (model: string) =>
        get().updateProjectConfig({ embeddingModel: model }),

      setRerankerModel: (model: string) =>
        get().updateProjectConfig({ rerankerModel: model }),

      setGoogleStoreName: (name: string) =>
        get().updateProjectConfig({ googleStoreName: name }),

      // Model Settings Actions
      updateModelSettingsConfig: (config) => 
        set((state) => ({ 
          modelSettingsConfig: { ...state.modelSettingsConfig, ...config } 
        })),

      setModels: (models) => 
        get().updateModelSettingsConfig({ models }),

      setProviders: (providers) => 
        get().updateModelSettingsConfig({ providers }),

      setWorkModel: (model) => 
        get().updateModelSettingsConfig({ workModel: model }),

      setScoreModel: (model) => 
        get().updateModelSettingsConfig({ scoreModel: model }),

      setWorkModelParams: (params) => 
        get().updateModelSettingsConfig({ workModelParams: params }),

      setScoreModelParams: (params) => 
        get().updateModelSettingsConfig({ scoreModelParams: params }),

      // Run Results Actions
      updateRunResultsConfig: (config) => 
        set((state) => ({ 
          runResultsConfig: { ...state.runResultsConfig, ...config } 
        })),

      setRunStatus: (status) => 
        get().updateRunResultsConfig({ runStatus: status }),

      startRun: () =>
        get().setRunStatus({
          isRunning: true,
          startTime: new Date(),
          endTime: undefined,
          error: undefined 
        }),

      stopRun: () =>
        get().updateRunResultsConfig({
          runStatus: {
            ...get().runResultsConfig.runStatus, // 保留 results, startTime 等
            isRunning: false,
            endTime: new Date()
          }
        }),

      setRunError: (error) => 
        get().updateRunResultsConfig({ 
          runStatus: { ...get().runResultsConfig.runStatus, error, isRunning: false } 
        }),

      setTestLoopCount: (count) =>
        get().updateRunResultsConfig({ testLoopCount: count }),

      setTotalTestScore: (score) =>
        get().updateRunResultsConfig({ totalTestScore: score }),

      // 添加新的 Actions 实现
      setCurrentTask: (task) =>
        get().updateRunResultsConfig({ currentTask: task }),

      setTotalTasks: (tasks) =>
        get().updateRunResultsConfig({ totalTasks: tasks }),

      setProgress: (progress) =>
        get().updateRunResultsConfig({ progress }),

      setIsExecuting: (executing) =>
        get().updateRunResultsConfig({ isExecuting: executing }),

      setIsCancelled: (cancelled) =>
        get().updateRunResultsConfig({ isCancelled: cancelled }),

      setActiveTaskMessage: (message) =>
        get().updateRunResultsConfig({ activeTaskMessage: message }),

      updateCurrentRunState: (newState) =>
        set((state) => ({
          runResultsConfig: {
            ...state.runResultsConfig,
            // 使用 Object.assign 来合并新旧状态，实现覆盖
            currentRunState: { ...state.runResultsConfig.currentRunState, ...newState },
          },
        })),

      clearCurrentRunState: () =>
        set((state) => ({
          runResultsConfig: {
            ...state.runResultsConfig,
            currentRunState: {},
          },
        })),
    }),
    {
      name: 'fta-app-storage',
      // 只持久化必要的配置数据，不包含临时状态
      partialize: (state) => ({
        projectConfig: {
          selectedProject: state.projectConfig.selectedProject,
          projectName: state.projectConfig.projectName,
          systemPrompt: state.projectConfig.systemPrompt,
          knowledgeBaseFiles: state.projectConfig.knowledgeBaseFiles,
          mcpTools: state.projectConfig.mcpTools,
          mcpToolsCode: state.projectConfig.mcpToolsCode,
          databaseType: state.projectConfig.databaseType,
          embeddingModel: state.projectConfig.embeddingModel,
          rerankerModel: state.projectConfig.rerankerModel,
          googleStoreName: state.projectConfig.googleStoreName
        },
        modelSettingsConfig: {
          workModel: state.modelSettingsConfig.workModel,
          scoreModel: state.modelSettingsConfig.scoreModel,
          workModelParams: state.modelSettingsConfig.workModelParams,
          scoreModelParams: state.modelSettingsConfig.scoreModelParams,
        },
        runResultsConfig: {
          testLoopCount: state.runResultsConfig.testLoopCount,
          totalTestScore: state.runResultsConfig.totalTestScore
        },
      }),
    }
  )
)