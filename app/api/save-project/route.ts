import { NextResponse } from "next/server"
import { writeFile, mkdir, copyFile, readdir, rm, access, rename } from "fs/promises"
import { join } from "path"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { projectName, systemPrompt, knowledgeBaseFiles, mcpTools, mcpToolsCode, databaseType, embeddingModel, rerankerModel, force } = body

    if (!projectName) {
      return NextResponse.json({ error: "项目名称不能为空" }, { status: 400 })
    }

    // 创建项目输出目录
    const projectDir = join(process.cwd(), "output", "project", projectName)
    const knowledgeDir = join(projectDir, "knowledge")

    // 检查项目目录是否已存在
    let isExistingProject = false
    const tempProjectDir = join(process.cwd(), "output", "project", `${projectName}_temp`)

    try {
      await access(projectDir)
      // 如果能访问到目录，说明已存在
      isExistingProject = true

      if (!force) {
        // 非强制覆盖模式：先在临时目录中准备文件
        await mkdir(tempProjectDir, { recursive: true })
        const tempKnowledgeDir = join(tempProjectDir, "knowledge")
        await mkdir(tempKnowledgeDir, { recursive: true })
      } else {
        // 如果强制覆盖，先删除现有目录
        await rm(projectDir, { recursive: true, force: true })
      }
    } catch (error) {
      // 目录不存在，可以继续创建
    }

    // 创建项目目录
    if (!isExistingProject || force) {
      await mkdir(projectDir, { recursive: true })
      await mkdir(knowledgeDir, { recursive: true })
    }

    // 复制知识库文件
    const copiedFiles = []
    const fileDataArray = body.fileData || []
    
    for (const filePath of knowledgeBaseFiles) {
      try {
        // 从请求数据中获取文件对象
        let fileData = fileDataArray.find((f: any) => f.path === filePath)

        // 如果没有精确匹配，尝试只匹配文件名
        if (!fileData) {
          const fileName = filePath.split('/').pop() || filePath
          fileData = fileDataArray.find((f: any) => {
            const dataFileName = f.path.split('/').pop() || f.path
            return dataFileName === fileName || f.name === fileName
          })
        }

        // 确定目标目录
        const targetKnowledgeDir = isExistingProject && !force ? join(tempProjectDir, "knowledge") : knowledgeDir

        if (fileData && fileData.content) {
          // 如果有文件内容数据，直接写入文件（新上传的文件）
          const fileName = filePath.split('/').pop() || filePath
          const destPath = join(targetKnowledgeDir, fileName)

          // 处理 data URL 格式 (data:text/plain;base64,...)
          let content = fileData.content
          if (content.startsWith('data:')) {
            // 移除 data URL 前缀，只保留 base64 部分
            const base64Content = content.split(',')[1]
            if (base64Content) {
              content = base64Content
            }
          }

          const buffer = Buffer.from(content, 'base64')
          await writeFile(destPath, buffer)
          copiedFiles.push({
            original: filePath,
            copied: `${projectName}/knowledge/${fileName}`
          })
        } else {
          // 如果没有文件内容数据，尝试从现有项目复制
          try {
            const fileName = filePath.split('/').pop() || filePath
            const sourcePath = join(projectDir, "knowledge", fileName)
            const destPath = join(targetKnowledgeDir, fileName)

            // 检查源文件是否存在，如果存在则复制
            await access(sourcePath)
            await copyFile(sourcePath, destPath)
            copiedFiles.push({
              original: filePath,
              copied: `${projectName}/knowledge/${fileName}`
            })
            console.log(`Copied existing file: ${filePath}`)
          } catch (copyError) {
            // 如果无法复制现有文件，记录警告
            console.warn(`Warning: Could not copy file ${filePath}. File may not exist in current project.`)
          }
        }
      } catch (error) {
        console.error(`Error processing file ${filePath}:`, error)
      }
    }

    // 生成MCP Tools的JSON格式数据
    const mcpToolsJson = mcpTools.map((tool: any) => ({
      name: tool.methodName,
      parameters: tool.methodParams,
      description: tool.description,
      returnValue: tool.returnValue
    }))

    // 生成项目文件内容
    const projectContent = `# ${projectName}

## 系统提示词
${systemPrompt}

## 知识库文件
${knowledgeBaseFiles.length > 0 ? knowledgeBaseFiles.map((file: string) => `- ${file}`).join('\n') : '无'}

## MCP Tools
${mcpTools.length > 0 ? '```json\n' + JSON.stringify(mcpToolsJson, null, 2) + '\n```' : '无'}

## MCP 服务器地址
${mcpToolsCode || '无'}

## 向量数据库和模型配置
- 向量数据库类型: ${databaseType || 'POSTGRES'}
- 向量嵌入模型: ${embeddingModel || 'nomic-embed-text:latest'}
- 重排序模型: ${rerankerModel || 'BAAI/bge-reranker-v2-m3'}

## 文件生成时间
${new Date().toLocaleString('zh-CN')}
`

    // 写入项目文件
    if (isExistingProject && !force) {
      // 对于现有项目且非强制覆盖模式，先写入到临时目录
      const tempProjectFilePath = join(tempProjectDir, "project.md")
      await writeFile(tempProjectFilePath, projectContent, 'utf-8')

      // 原子性地替换目录：删除旧目录，重命名临时目录
      await rm(projectDir, { recursive: true, force: true })
      await rename(tempProjectDir, projectDir)
    } else {
      // 新建项目或强制覆盖模式，直接写入
      const projectFilePath = join(projectDir, "project.md")
      await writeFile(projectFilePath, projectContent, 'utf-8')
    }

    return NextResponse.json({
      success: true,
      message: "项目保存成功",
      projectFile: `${projectName}/project.md`,
      copiedFiles: copiedFiles,
      mcpToolsCount: mcpTools.length
    })

  } catch (error) {
    console.error("Error saving project:", error)
    return NextResponse.json(
      { error: "保存项目时发生错误" },
      { status: 500 }
    )
  }
}