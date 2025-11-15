"use client"

import { useEffect, useRef, useCallback, useState } from "react"
import { useAppStore } from "@/store/app-store"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { FolderOpen, FileText, Upload, Trash2, Loader2, Save, Edit, AlertTriangle, RefreshCw } from "lucide-react"

// 自动调整textarea高度的组件
const AutoResizeTextarea = ({
  value,
  onChange,
  placeholder,
  className = "",
  maxRows = 20,
  disabled = false
}: {
  value: string
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  placeholder: string
  className?: string
  maxRows?: number
  disabled?: boolean
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    // 重置高度到初始状态以便正确计算
    textarea.style.height = 'auto'

    // 计算滚动高度
    const scrollHeight = textarea.scrollHeight

    // 计算行高
    const lineHeight = parseInt(getComputedStyle(textarea).lineHeight)

    // 计算需要的行数
    const neededRows = Math.ceil(scrollHeight / lineHeight)

    // 限制最大行数
    const maxAllowedRows = Math.min(neededRows, maxRows)

    // 设置新高度
    const newHeight = maxAllowedRows * lineHeight
    textarea.style.height = `${newHeight}px`
  }, [maxRows])

  useEffect(() => {
    adjustHeight()
  }, [value, adjustHeight])

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => {
        onChange(e)
        adjustHeight()
      }}
      placeholder={placeholder}
      disabled={disabled}
      className={`w-full bg-transparent border-0 border-b border-border px-0 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors resize-none min-h-[2rem] max-h-[40rem] disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      rows={1}
    />
  )
}

// 为模型定义清晰的类型
interface EmbeddingModel {
  name: string;
  dimensions: number;
}

interface RerankerModel {
  name: string;
  description: string;
}

// 为整个配置对象定义类型
interface ConfigOptions {
  databaseTypes: string[];
  embeddingModels: EmbeddingModel[];
  rerankerModels: RerankerModel[];
}

export function ProjectOverview() {
  const {
    projectConfig: {
      selectedProject,
      projectFiles,
      projectName,
      systemPrompt,
      knowledgeBaseFiles,
      knowledgeBaseFileData,
      isDragging,
      mcpTools,
      mcpToolsCode,
      parseError,
      isLoading,
      isEditMode,
      showSuccess,
      showProjectExistsDialog,
      existingProjectName,
      databaseType,
      embeddingModel,
      rerankerModel
    },
    setSelectedProject,
    setProjectFiles,
    setProjectName,
    setSystemPrompt,
    setKnowledgeBaseFiles,
    setKnowledgeBaseFileData,
    setIsDragging,
    setMcpTools,
    setMcpToolsCode,
    setParseError,
    setProjectLoading,
    setIsEditMode,
    setShowSuccess,
    setShowProjectExistsDialog,
    setExistingProjectName,
    setDatabaseType,
    setEmbeddingModel,
    setRerankerModel
  } = useAppStore()

  // 添加加载状态
  const [isFetchingTools, setIsFetchingTools] = useState(false)
  const [isVectorizing, setIsVectorizing] = useState(false)

  useEffect(() => {
    // Fetch the list of project folders
    async function fetchProjectFiles() {
      try {
        const response = await fetch("/api/history-projects")
        if (response.ok) {
          const projects = await response.json()
          setProjectFiles(projects)
        }
      } catch (error) {
        console.error("Failed to fetch project files:", error)
      }
    }

    fetchProjectFiles()
  }, [])

  // 确保在组件加载时和项目变化时正确设置编辑状态
  useEffect(() => {
    // 只有当项目列表加载完成后再设置编辑状态
    if (projectFiles && projectFiles.length > 0) {
      if (selectedProject === "自定义") {
        setIsEditMode(true)
      } else {
        setIsEditMode(false)
      }
    }
  }, [selectedProject, projectFiles, setIsEditMode])

  // 处理项目选择变化
  const handleProjectChange = async (projectName: string) => {
    setSelectedProject(projectName)

    if (projectName === "自定义") {
      // 清空表单，让用户自定义
      setProjectName("")
      setSystemPrompt("")
      setKnowledgeBaseFiles([])
      setMcpTools([])
      setMcpToolsCode("")
      setIsEditMode(true)
      return
    }

    // 加载选中项目的数据
    setProjectLoading(true)
    try {
      const response = await fetch(`/api/history-projects?projectName=${encodeURIComponent(projectName)}`)
      if (response.ok) {
        const projectData = await response.json()

        // 填充表单数据
        setProjectName(projectData.projectName || projectName)
        setSystemPrompt(projectData.systemPrompt || "")
        setKnowledgeBaseFiles(projectData.knowledgeBaseFiles || [])
        setKnowledgeBaseFileData([]) // 重置文件数据，因为重新加载项目时需要重新选择文件

        // 处理 MCP Tools
        if (projectData.mcpTools && projectData.mcpTools.length > 0) {
          const toolsWithIds = projectData.mcpTools.map((tool: any, index: number) => ({
            id: `loaded-${Date.now()}-${index}`,
            methodName: tool.methodName || "",
            methodParams: tool.methodParams || "",
            description: tool.description || "",
            returnValue: tool.returnValue || ""
          }))
          setMcpTools(toolsWithIds)
        } else {
          setMcpTools([])
        }

        // 设置MCP服务器地址
        if (projectData.mcpToolsCode) {
          setMcpToolsCode(projectData.mcpToolsCode)
        } else {
          setMcpToolsCode("")
        }

        // 设置向量数据库和模型配置
        if (projectData.databaseType) {
          setDatabaseType(projectData.databaseType)
        }
        if (projectData.embeddingModel) {
          setEmbeddingModel(projectData.embeddingModel)
        }
        if (projectData.rerankerModel) {
          setRerankerModel(projectData.rerankerModel)
        }

        setIsEditMode(false) // 选择已存在的项目时，默认为查看模式
      } else {
        console.error("Failed to load project data")
      }
    } catch (error) {
      console.error("Error loading project data:", error)
    } finally {
      setProjectLoading(false)
    }
  }

  const handleSave = async () => {
    const validationErrors = []

    if (!projectName.trim()) {
      validationErrors.push("项目名称")
    }

    if (!systemPrompt.trim()) {
      validationErrors.push("系统提示词")
    }

    if (validationErrors.length > 0) {
      const errorMessage = `请填写以下必填项目：\n• ${validationErrors.join("\n• ")}`

      // 创建自定义模态框而不是使用alert，使用项目主题色
      const modal = document.createElement('div')
      modal.className = 'fixed inset-0 flex items-center justify-center z-50'
      modal.innerHTML = `
        <div class="bg-card border border-border rounded-lg p-6 max-w-md mx-4 shadow-lg">
          <h3 class="text-lg font-semibold mb-4 text-foreground">提示</h3>
          <p class="text-muted-foreground mb-6 whitespace-pre-line">${errorMessage}</p>
          <div class="flex justify-end">
            <button id="modal-ok" class="px-4 py-2 bg-foreground text-background rounded hover:bg-foreground/90 focus:outline-none focus:ring-2 focus:ring-primary transition-colors">
              确定
            </button>
          </div>
        </div>
      `
      document.body.appendChild(modal)

      // 点击确定按钮关闭模态框
      const okButton = modal.querySelector('#modal-ok') as HTMLElement
      const closeModal = () => {
        document.body.removeChild(modal)
      }
      okButton.addEventListener('click', closeModal)

      // 点击背景也可以关闭
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          closeModal()
        }
      })

      // ESC键关闭
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          closeModal()
          document.removeEventListener('keydown', handleEscape)
        }
      }
      document.addEventListener('keydown', handleEscape)

      return
    }

    setProjectLoading(true)
    setShowSuccess(false)

    try {
      const response = await fetch("/api/save-project", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectName: projectName.trim(),
          systemPrompt: systemPrompt.trim(),
          knowledgeBaseFiles: knowledgeBaseFiles,
          fileData: knowledgeBaseFileData,
          mcpTools: mcpTools,
          mcpToolsCode: mcpToolsCode,
          databaseType: databaseType,
          embeddingModel: embeddingModel,
          rerankerModel: rerankerModel
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        if (response.status === 409 && result.exists) {
          // 项目已存在，显示确认对话框
          setExistingProjectName(result.projectName)
          setShowProjectExistsDialog(true)
          return
        }
        throw new Error(result.error || "保存失败")
      }

      // 保存成功，切换到编辑模式
      setIsEditMode(false)
      setShowSuccess(true)

      // 刷新项目列表
      try {
        const response = await fetch("/api/history-projects")
        if (response.ok) {
          const projects = await response.json()
          setProjectFiles(projects)
          // 选中新创建的项目
          setSelectedProject(projectName.trim())
        }
      } catch (error) {
        console.error("Failed to refresh project list:", error)
      }

      // 3秒后隐藏成功提示
      setTimeout(() => {
        setShowSuccess(false)
      }, 3000)

      console.log("Project saved successfully:", result)
    } catch (error) {
      console.error("Error saving project:", error)
      alert(`保存失败: ${error instanceof Error ? error.message : "未知错误"}`)
    } finally {
      setProjectLoading(false)
    }
  }

  const handleEdit = () => {
    setIsEditMode(true)
  }

  const handleProjectExistsCancel = () => {
    setShowProjectExistsDialog(false)
    setExistingProjectName("")
  }

  const handleProjectExistsReplace = async () => {
    if (!existingProjectName) return

    setProjectLoading(true)
    setShowProjectExistsDialog(false)

    try {
      // 使用强制覆盖参数重新保存项目
      const response = await fetch("/api/save-project", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectName: projectName.trim(),
          systemPrompt: systemPrompt.trim(),
          knowledgeBaseFiles: knowledgeBaseFiles,
          fileData: knowledgeBaseFileData,
          mcpTools: mcpTools,
          mcpToolsCode: mcpToolsCode,
          databaseType: databaseType,
          embeddingModel: embeddingModel,
          rerankerModel: rerankerModel,
          force: true
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "保存失败")
      }

      // 保存成功，切换到编辑模式
      setIsEditMode(false)
      setShowSuccess(true)

      // 刷新项目列表
      try {
        const response = await fetch("/api/history-projects")
        if (response.ok) {
          const projects = await response.json()
          setProjectFiles(projects)
          // 选中新创建的项目
          setSelectedProject(projectName.trim())
        }
      } catch (error) {
        console.error("Failed to refresh project list:", error)
      }

      // 3秒后隐藏成功提示
      setTimeout(() => {
        setShowSuccess(false)
      }, 3000)

      console.log("Project replaced successfully:", result)
    } catch (error) {
      console.error("Error replacing project:", error)
      alert(`替换项目失败: ${error instanceof Error ? error.message : "未知错误"}`)
    } finally {
      setProjectLoading(false)
      setExistingProjectName("")
    }
  }

  const handleKnowledgeBaseFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files) return

    const newFilePaths: string[] = []
    const newFileData: any[] = []

    // 处理文件读取
    const processFiles = async () => {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const path = file.webkitRelativePath || file.name

        if (file.webkitRelativePath) {
          // 如果是文件夹中的文件，webkitRelativePath 会包含相对路径
          const parts = path.split('/')
          const folderName = parts[0]
          const fileName = parts.slice(1).join('/')
          const fullPath = `${folderName}/${fileName}`
          newFilePaths.push(fullPath)
        } else {
          // 单个文件
          newFilePaths.push(file.name)
        }

        // 读取文件内容
        try {
          const fileContent = await readFileAsBase64(file)
          newFileData.push({
            path: file.webkitRelativePath || file.name,
            content: fileContent,
            name: file.name,
            size: file.size,
            type: file.type
          })
        } catch (error) {
          console.error(`Error reading file ${file.name}:`, error)
        }
      }

      // 调试：打印选择的文件路径和文件数据
      console.log("选择的文件路径:", newFilePaths)
      console.log("文件数据:", newFileData)

      // 追加新文件到现有列表，避免重复
      const existingFilesSet = new Set(knowledgeBaseFiles)
      const uniqueNewFiles = newFilePaths.filter(file => !existingFilesSet.has(file))

      // 追加新文件数据到现有列表
      const existingFilesDataMap = new Map((knowledgeBaseFileData || []).map(f => [f.path, f]))
      const uniqueNewFileData = newFileData.filter(f => !existingFilesDataMap.has(f.path))

      setKnowledgeBaseFiles([...knowledgeBaseFiles, ...uniqueNewFiles])
      setKnowledgeBaseFileData([...(knowledgeBaseFileData || []), ...uniqueNewFileData])
    }

    processFiles()
  }

  // 辅助函数：将文件读取为Base64
  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(file)
    })
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const items = e.dataTransfer.items
    if (!items) return

    const newFilePaths: string[] = []
    const newFileData: any[] = []
    const processedEntries = new Set<string>()

    // 递归处理文件系统中的条目
    const processEntry = async (entry: FileSystemEntry, relativePath = '') => {
      if (processedEntries.has(entry.fullPath)) return
      processedEntries.add(entry.fullPath)

      if (entry.isFile) {
        const fileEntry = entry as FileSystemFileEntry
        return new Promise<void>((resolve) => {
          fileEntry.file(async (file) => {
            const filePath = relativePath ? `${relativePath}/${file.name}` : file.name
            newFilePaths.push(filePath)

            try {
              const fileContent = await readFileAsBase64(file)
              newFileData.push({
                path: filePath,
                content: fileContent,
                name: file.name,
                size: file.size,
                type: file.type
              })
            } catch (error) {
              console.error(`Error reading file ${file.name}:`, error)
            }
            resolve()
          })
        })
      } else if (entry.isDirectory) {
        const dirEntry = entry as FileSystemDirectoryEntry
        const dirReader = dirEntry.createReader()

        return new Promise<void>((resolve) => {
          dirReader.readEntries(async (entries) => {
            for (const entry of entries) {
              const newRelativePath = relativePath ? `${relativePath}/${entry.name}` : entry.name
              await processEntry(entry, newRelativePath)
            }
            resolve()
          })
        })
      }
    }

    // 处理拖拽的项目
    const processDroppedItems = async () => {
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        const entry = item.webkitGetAsEntry()

        if (entry) {
          if (entry.isFile) {
            // 处理单个文件
            await processEntry(entry)
          } else if (entry.isDirectory) {
            // 处理文件夹 - 递归获取所有文件
            await processEntry(entry, entry.name)
          }
        }
      }

      // 调试：打印拖拽的文件路径和文件数据
      console.log("拖拽的文件路径:", newFilePaths)
      console.log("拖拽的文件数据:", newFileData)

      // 追加新文件到现有列表，避免重复
      const existingFilesSet = new Set(knowledgeBaseFiles)
      const uniqueNewFiles = newFilePaths.filter(file => !existingFilesSet.has(file))

      // 追加新文件数据到现有列表
      const existingFilesDataMap = new Map((knowledgeBaseFileData || []).map(f => [f.path, f]))
      const uniqueNewFileData = newFileData.filter(f => !existingFilesDataMap.has(f.path))

      setKnowledgeBaseFiles([...knowledgeBaseFiles, ...uniqueNewFiles])
      setKnowledgeBaseFileData([...(knowledgeBaseFileData || []), ...uniqueNewFileData])
    }

    processDroppedItems()
  }

  // 向量化知识库功能
  const vectorizeKnowledgeBase = async () => {
    if (knowledgeBaseFiles.length === 0) {
      alert('请先选择知识库文件');
      return;
    }

    setIsVectorizing(true);
    try {
      const response = await fetch('/api/vectorize-knowledge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectName: projectName.trim(),
          databaseType: databaseType,
          embeddingModel: embeddingModel,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || '向量化失败');
      }

      // 显示成功消息
      alert(`知识库向量化成功！\n数据库类型: ${result.databaseType}\n嵌入模型: ${result.embeddingModel}`);
    } catch (error) {
      console.error('向量化知识库失败:', error);
      alert(`向量化失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsVectorizing(false);
    }
  };

  const clearKnowledgeBaseFiles = () => {
    setKnowledgeBaseFiles([])
    setKnowledgeBaseFileData([])
  }

  const removeMcpTool = (id: string) => {
    setMcpTools((mcpTools || []).filter(tool => tool.id !== id))
  }

  const updateMcpTool = (id: string, field: 'methodName' | 'methodParams' | 'description' | 'returnValue', value: string) => {
    setMcpTools((mcpTools || []).map(tool =>
      tool.id === id ? { ...tool, [field]: value } : tool
    ))
  }

  const parseMcpToolsCode = async () => {
    setParseError("")
    const input = mcpToolsCode.trim()

    if (!input) {
      setParseError("请输入MCP服务器地址")
      return
    }

    // 直接获取MCP服务器工具
    await fetchToolsFromServer(input)
  }

  // 从MCP服务器获取工具
  const fetchToolsFromServer = async (serverUrl: string) => {
    setIsFetchingTools(true)
    setParseError("")

    try {
      // 标准化URL
      let url = serverUrl.trim()
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'http://' + url
      }

      // 确保URL以/结尾
      if (!url.endsWith('/')) {
        url += '/'
      }

      // 使用API路由与MCP服务器通信
      const response = await fetch(`/api/mcp-tools?url=${encodeURIComponent(url)}`)
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `无法连接到MCP服务器: ${response.status}`)
      }

      const data = await response.json()
      
      if (!data.success || !data.tools) {
        throw new Error("服务器返回的格式不正确")
      }

      // 转换工具格式 - 兼容两种新格式
      const parsedTools = data.tools.map((tool: any) => {
        let methodParams = ""

        // 获取工具信息 - 兼容两种格式
        const functionInfo = tool.function || tool
        const methodName = functionInfo.name || ""
        const description = functionInfo.description || ""

        // 处理参数结构
        if (functionInfo.parameters) {
          const parameters = functionInfo.parameters

          // 第一种格式：parameters 包含 properties 和 title 等字段
          if (parameters.properties && parameters.type === "object") {
            const params = parameters.properties
            const paramNames = Object.keys(params)

            methodParams = paramNames.map(name => {
              const param = params[name]
              const type = param.type || "string"
              const description = param.description || ""
              // 检查是否为必需参数
              const required = parameters.required?.includes(name) || false
              const requiredStr = required ? " (必需)" : " (可选)"
              return `${name}:${type}:${description}${requiredStr}`
            }).join(";")
          }
          // 第二种格式：parameters 直接包含 type 和 properties
          else if (parameters.type === "object" && parameters.properties) {
            const params = parameters.properties
            const paramNames = Object.keys(params)

            methodParams = paramNames.map(name => {
              const param = params[name]
              const type = param.type || "string"
              const description = param.description || ""
              // 检查是否为必需参数
              const required = parameters.required?.includes(name) || false
              const requiredStr = required ? " (必需)" : " (可选)"
              return `${name}:${type}:${description}${requiredStr}`
            }).join(";")
          }
          // 处理复杂类型（如 anyOf）
          else if (parameters.properties) {
            const params = parameters.properties
            const paramNames = Object.keys(params)

            methodParams = paramNames.map(name => {
              const param = params[name]
              let type = "string"

              // 处理 anyOf 类型
              if (param.anyOf) {
                type = param.anyOf.map((item: any) => item.type || "string").join("|")
              } else {
                type = param.type || "string"
              }

              const description = param.description || ""
              // 检查是否为必需参数
              const required = parameters.required?.includes(name) || false
              const requiredStr = required ? " (必需)" : " (可选)"
              return `${name}:${type}:${description}${requiredStr}`
            }).join(";")
          }
        }

        return {
          methodName: methodName,
          methodParams: methodParams,
          description: description,
          returnValue: "" // 新格式中可能不包含返回值信息
        }
      })

      if (parsedTools.length === 0) {
        throw new Error("未获取到任何工具信息")
      }

      // 生成工具列表，追加到现有列表中
      const newTools = parsedTools.map((tool: any, index: any) => ({
        id: `fetched-${Date.now()}-${index}`,
        methodName: tool.methodName,
        methodParams: tool.methodParams,
        description: tool.description,
        returnValue: tool.returnValue
      }))

      // 追加到现有工具列表
      // setMcpTools([...(mcpTools || []), ...newTools])
      // 清空现有工具列表并设置新工具
      setMcpTools(newTools)
      
    } catch (error) {
      setParseError(`获取失败: ${error instanceof Error ? error.message : '未知错误'}`)
    } finally {
      setIsFetchingTools(false)
    }
  }

  const [configOptions, setConfigOptions] = useState<ConfigOptions>({
    databaseTypes: [],
    embeddingModels: [],
    rerankerModels: [],
  });
  const [configError, setConfigError] = useState<string | null>(null);

  // 2. 使用 useEffect 在组件加载时获取配置
  useEffect(() => {
    async function fetchConfig() {
      try {
        const response = await fetch('/api/vectorize-config');
        if (!response.ok) {
          throw new Error('无法从服务器获取配置选项。');
        }
        const data: ConfigOptions = await response.json();
        setConfigOptions(data);

        // 初始化 AppStore 中的状态
        if (data.databaseTypes?.length > 0) {
          if (!databaseType || !data.databaseTypes.includes(databaseType)) {
            setDatabaseType(data.databaseTypes[0]);
          }
        }

        if (data.embeddingModels?.length > 0) {
          if (!embeddingModel || !data.embeddingModels.some(m => m.name === embeddingModel)) {
            setEmbeddingModel(data.embeddingModels[0].name);
          }
        }

        if (data.rerankerModels?.length > 0) {
          if (!rerankerModel || !data.rerankerModels.some(m => m.name === rerankerModel)) {
            setRerankerModel(data.rerankerModels[0].name);
          }
        }
      } catch (error) {
        console.error("获取配置失败:", error);
        setConfigError(error instanceof Error ? error.message : "未知错误");
      }
    }
    fetchConfig();
  }, []);

  return (
    <div className="p-4 md:p-8 max-w-full md:max-w-4xl lg:max-w-5xl xl:max-w-6xl mx-auto">
      <div className="mb-6 border-b border-border pb-4 md:mb-8">
        <h1 className="text-xl font-semibold text-foreground md:text-2xl">项目配置</h1>
      </div>

      <div className="space-y-6 md:space-y-8">
        <div className="space-y-2">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <Label className="text-sm font-medium text-foreground">历史项目</Label>
              <div className="text-xs text-muted-foreground mt-1">{selectedProject}</div>
            </div>
            <Select
              value={selectedProject}
              onValueChange={handleProjectChange}
              disabled={isLoading}
            >
              <SelectTrigger className="w-full md:w-80 disabled:opacity-50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="自定义">自定义</SelectItem>
                {(projectFiles || []).map((projectName) => (
                  <SelectItem key={projectName} value={projectName}>
                    {projectName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">项目名称</Label>
          <AutoResizeTextarea
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="请输入项目名称..."
            disabled={!isEditMode || isLoading}
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">系统提示词</Label>
          <AutoResizeTextarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            placeholder="请输入真实项目的系统提示词，模拟真实项目背景，以获得最真实的生成环境测试结果..."
            disabled={!isEditMode || isLoading}
          />
        </div>

        {/* 知识库区域 */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div>
                <h2 className="text-lg font-medium text-foreground">知识库</h2>
                <p className="text-sm text-muted-foreground">选择文件或文件夹作为知识库</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="file"
                onChange={handleKnowledgeBaseFileSelect}
                className="hidden"
                id="knowledge-base-file-select"
              />
              <Button
                variant="outline"
                onClick={() => document.getElementById('knowledge-base-file-select')?.click()}
                className="flex items-center gap-2 disabled:opacity-50"
                disabled={!isEditMode || isLoading}
              >
                <Upload className="h-4 w-4" />
                选择文件
              </Button>
            </div>
          </div>

          {/* 拖拽区域 */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragging
                ? 'border-primary bg-primary/5'
                : !isEditMode || isLoading
                ? 'border-muted bg-muted/20 cursor-not-allowed'
                : 'border-border hover:border-primary/50 hover:bg-primary/5'
            }`}
            onDragOver={!isEditMode || isLoading ? undefined : handleDragOver}
            onDragLeave={!isEditMode || isLoading ? undefined : handleDragLeave}
            onDrop={!isEditMode || isLoading ? undefined : handleDrop}
          >
            <FolderOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground mb-2">
              拖拽文件或文件夹到此处，或点击上方按钮
            </p>
            <p className="text-xs text-muted-foreground">
              选择单个文件
            </p>
          </div>

          {/* 选择的文件路径显示 */}
          {(knowledgeBaseFiles || []).length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-foreground">
                  已选择的文件 ({(knowledgeBaseFiles || []).length})
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearKnowledgeBaseFiles}
                  className="text-xs disabled:opacity-50"
                  disabled={!isEditMode || isLoading}
                >
                  清除
                </Button>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 max-h-60 overflow-y-auto">
                {(knowledgeBaseFiles || []).map((filePath, index) => (
                  <div key={index} className="flex items-center gap-2 py-1">
                    <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-sm text-foreground font-mono break-all">
                      {filePath}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 向量数据库和模型配置区域 */}
          <div className="space-y-6">
            <h2 className="text-lg font-medium text-foreground">向量数据库和模型配置</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* 向量数据库选择 */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  向量数据库类型
                </label>
                <select
                  value={databaseType}
                  onChange={(e) => setDatabaseType(e.target.value)}
                  disabled={!isEditMode || isLoading}
                  className="w-full p-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {configOptions.databaseTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  选择用于向量存储的数据库
                </p>
              </div>

              {/* 向量模型选择 */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  向量嵌入模型
                </label>
                <select
                  value={embeddingModel}
                  onChange={(e) => setEmbeddingModel(e.target.value)}
                  disabled={!isEditMode || isLoading}
                  className="w-full p-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {configOptions.embeddingModels.map((model) => (
                    <option key={model.name} value={model.name}>
                      {model.name} ({model.dimensions}维)
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  用于将文本转换为向量的嵌入模型
                </p>
              </div>

              {/* 重排序模型选择 */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  重排序模型
                </label>
                <select
                  value={rerankerModel}
                  onChange={(e) => setRerankerModel(e.target.value)}
                  disabled={!isEditMode || isLoading}
                  className="w-full p-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {configOptions.rerankerModels.map((model) => (
                    <option key={model.name} value={model.name}>
                      {model.name.split('/').pop()} {/* 只显示模型名称部分 */}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  用于优化搜索结果相关性的重排序模型
                </p>
              </div>

              {/* 向量化知识库按钮 */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  知识库向量化
                </label>
                <Button
                  onClick={vectorizeKnowledgeBase}
                  className="flex items-center gap-2 disabled:opacity-50 w-full"
                  disabled={!isEditMode || isLoading || isVectorizing || knowledgeBaseFiles.length === 0}
                >
                  {isVectorizing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      向量化中...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4" />
                      向量化知识库
                    </>
                  )}
                </Button>
                <p className="text-xs text-muted-foreground">
                  将知识库文件转换为向量数据用于语义搜索
                </p>
              </div>
            </div>

            {/* 模型配置说明 */}
            <div className="bg-muted/30 rounded-lg p-4">
              <h3 className="text-sm font-medium text-foreground mb-2">当前配置说明</h3>
              <div className="text-xs text-muted-foreground space-y-1">
                <p><strong>向量数据库:</strong> {databaseType}</p>
                <p><strong>嵌入模型:</strong> {embeddingModel} ({configOptions.embeddingModels.find(m => m.name === embeddingModel)?.dimensions || '...'}维)</p>
                <p><strong>重排序模型:</strong> {configOptions.rerankerModels.find(m => m.name === rerankerModel)?.description}</p>
              </div>
            </div>
          </div>
        </div>

        {/* MCP Tools 区域 */}
        <div className="space-y-6">
          <div className="space-y-4">
            <h2 className="text-lg font-medium text-foreground">MCP Tools</h2>

            {/* MCP Tools 代码输入区域 */}
            <div className="space-y-3">
              <textarea
                value={mcpToolsCode}
                onChange={(e) => setMcpToolsCode(e.target.value)}
                placeholder={`输入MCP服务器地址，例如：http://127.0.0.1:8000`}
                disabled={!isEditMode || isLoading}
                className="w-full h-[3rem] p-3 border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none font-mono text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              />

              {/* 解析按钮和错误提示 */}
              <div className="flex items-center gap-4">
                <Button
                  onClick={parseMcpToolsCode}
                  className="flex items-center gap-2 disabled:opacity-50"
                  disabled={!isEditMode || isLoading || isFetchingTools}
                >
                  {isFetchingTools ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      获取中...
                    </>
                  ) : (
                    "获取工具"
                  )}
                </Button>

                {parseError && (
                  <div className="text-sm text-destructive bg-destructive/10 px-3 py-1.5 rounded-md">
                    {parseError}
                  </div>
                )}
              </div>
            </div>

            {(mcpTools || []).map((tool, index) => (
              <div key={tool.id} className="border border-border rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-foreground">Tool call {index + 1}</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeMcpTool(tool.id)}
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive disabled:opacity-50"
                    disabled={!isEditMode || isLoading}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                {/* 方法名 */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-foreground">方法名(name)</Label>
                  <AutoResizeTextarea
                    value={tool.methodName}
                    onChange={(e) => updateMcpTool(tool.id, 'methodName', e.target.value)}
                    placeholder="工具的方法名称，mcp工具函数名都是英文名称..."
                    disabled={!isEditMode || isLoading}
                  />
                </div>

                {/* 方法参数 */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-foreground">方法参数(parameters)</Label>
                  <AutoResizeTextarea
                    value={tool.methodParams}
                    onChange={(e) => updateMcpTool(tool.id, 'methodParams', e.target.value)}
                    placeholder="方法支持的参数名称、类型和描述，多个参数用;分隔，例如：get_current_time:string:获取当前时间;get_current_date:string:获取当前日期"
                    disabled={!isEditMode || isLoading}
                  />
                </div>

                {/* 功能描述 */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-foreground">功能描述(description)</Label>
                  <AutoResizeTextarea
                    value={tool.description}
                    onChange={(e) => updateMcpTool(tool.id, 'description', e.target.value)}
                    placeholder="工具功能描述"
                    disabled={!isEditMode || isLoading}
                  />
                </div>

                {/* 返回值 */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-foreground">返回值(returnValue)</Label>
                  <AutoResizeTextarea
                    value={tool.returnValue}
                    onChange={(e) => updateMcpTool(tool.id, 'returnValue', e.target.value)}
                    placeholder="工具返回值"
                    disabled={!isEditMode || isLoading}
                  />
                </div>
              </div>
            ))}

            </div>
        </div>


        <div className="flex justify-end gap-4 pt-4">
          {showSuccess && (
            <div className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-800 rounded-md">
              <Save className="h-4 w-4" />
              <span className="text-sm">应用成功</span>
            </div>
          )}

          <Button
            onClick={isEditMode ? handleSave : handleEdit}
            className="bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                保存中...
              </>
            ) : isEditMode ? (
              <>
                <Save className="h-4 w-4 mr-2" />
                应用
              </>
            ) : (
              <>
                <Edit className="h-4 w-4 mr-2" />
                编辑
              </>
            )}
          </Button>
        </div>
      </div>

      {/* 项目已存在确认对话框 */}
      <Dialog open={showProjectExistsDialog} onOpenChange={setShowProjectExistsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              项目已存在
            </DialogTitle>
            <DialogDescription>
              项目 "{existingProjectName}" 已存在。是否要替换现有项目？替换操作将删除现有项目的所有文件。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={handleProjectExistsCancel}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleProjectExistsReplace} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  替换中...
                </>
              ) : (
                "替换"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
