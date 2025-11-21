// lib/db/google/index.ts
import fs from 'fs/promises';
import path from 'path';
import { GoogleGenAI } from "@google/genai";
import { DataAccess, Document } from '../core/interface';

export class GoogleFileSearch implements DataAccess {
  private client: GoogleGenAI;
  private targetDisplayName: string;
  private storeName: string | null = null;
  private modelName = "gemini-2.5-flash";

  // 构造函数接收前端传来的 storeName
  constructor(displayName?: string) {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      throw new Error("使用 Google File Search 必须配置 GOOGLE_API_KEY");
    }
    this.client = new GoogleGenAI({ apiKey: apiKey });

    if (!displayName) {
      throw new Error("初始化失败: Google File Search Store Name 不能为空。");
    }

    this.targetDisplayName = displayName;
    console.log(`GoogleFileSearch instance created. Target Store: ${this.targetDisplayName}`);
  }

  async init(): Promise<void> {
    try {
      const existingId = await this.findStoreByName(this.targetDisplayName);
      if (existingId) {
        this.storeName = existingId;
        console.log(`[GoogleFileSearch] Initialized. Linked to existing store: ${this.storeName}`);
      }
    } catch (e) {
      console.error("Init warning:", e);
    }
  }

  /**
   * 根据 Display Name 查找云端的文件商店名称
   */
  async findStoreByName(displayName: string): Promise<string | null> {
    try {
      const listResp = await this.client.fileSearchStores.list();
      for await (const store of listResp) {
        if (store.displayName === displayName) {
          return store.name || null;
        }
      }
      return null;
    } catch (e) {
      console.error("Error listing stores:", e);
      return null;
    }
  }

  /**
   * API 逻辑：
   * 1. 调用 checkStoreExists() -> 返回 bool
   * 2. 如果存在且 !force -> 报错
   * 3. 如果存在且 force -> migrate() 内部执行删除+创建
   * 4. 如果不存在 -> migrate() 内部执行创建
   * 
   * migrate 的职责是：确保一个名为 targetDisplayName 的 空Store 准备好。
   */
  async migrate(): Promise<void> {
    console.log(`--- Preparing Google Store: ${this.targetDisplayName} ---`);
    
    // 1. 检查是否存在
    const existingName = await this.findStoreByName(this.targetDisplayName);

    if (existingName) {
      console.log(`Found existing store: ${existingName}. Deleting as part of migration/overwrite...`);
      try {
        await this.client.fileSearchStores.delete({
          name: existingName,
          config: { force: true } // 强制删除，包含文件
        });
        console.log("Existing store deleted.");
      } catch (e: any) {
        console.error("Failed to delete existing store:", e.message);
        throw e;
      }
    }

    // 2. 创建新的
    console.log(`Creating new store: ${this.targetDisplayName}...`);
    const newStore = await this.client.fileSearchStores.create({
      config: { displayName: this.targetDisplayName }
    });
    
    this.storeName = newStore.name || null;
    console.log(`Store created successfully: ${this.storeName}`);
  }

  /**
   * 供 API 调用的检查方法
   */
  async checkStoreExists(): Promise<boolean> {
    const id = await this.findStoreByName(this.targetDisplayName);
    return !!id;
  }

  /**
   * 填充数据
   */
  async seed(directoryPath: string): Promise<void> {
    if (!this.storeName) {
      throw new Error("Store not initialized. Call migrate() first.");
    }

    console.log(`--- Seeding files to ${this.storeName} ---`);
    const files = await fs.readdir(directoryPath);

    for (let fileName of files) {
      let filePath = path.join(directoryPath, fileName);
      // 文件名称清洗，google文件搜索不支持上传包含中文字符串名称的文件，会导致 Character > 255 的错误
      // 检查文件名是否包含非 ASCII 字符 (如中文、全角符号等)
      if (/[^\x00-\x7F]/.test(fileName)) {
        console.log(`[Renaming] Found non-ASCII characters in: ${fileName}`);
        // 替换策略：将非 ASCII 字符替换为下划线 _，保留扩展名
        const ext = path.extname(fileName);
        const nameWithoutExt = path.basename(fileName, ext);
        // 替换非 ASCII 字符，并确保文件名不为空
        let safeName = nameWithoutExt.replace(/[^\x00-\x7F]/g, '_');
        if (safeName.length === 0 || safeName === '________________') {
            safeName = `renamed_file_${Date.now()}`;
        }
        const newFileName = `${safeName}${ext}`;
        const newFilePath = path.join(directoryPath, newFileName);
        try {
          // 物理文件重命名
          await fs.rename(filePath, newFilePath);
          console.log(`  -> Renamed to: ${newFileName}`);

          // 同步更新 project.md 中的引用
          await this.syncProjectMetadata(directoryPath, fileName, newFileName);

          // 更新变量以供后续逻辑使用
          fileName = newFileName;
          filePath = newFilePath;
        } catch (renameError) {
          console.error(`  -> Failed to rename file: ${renameError}`);
          // 如果重命名失败，尝试跳过或继续尝试原名(大概率还会挂)
          continue; 
        }
      }

      const mimeType = this.getMimeType(fileName);
      if (!mimeType) {
        console.log(`Skipping unsupported file type: ${fileName}`);
        continue;
      }

      console.log(`Uploading ${fileName} (${mimeType})...`);

      let attempts = 0;
      const maxRetries = 2;
      let uploadSuccess = false;
      while (attempts <= maxRetries && !uploadSuccess) {
          try {
            if (attempts > 0) {
                console.log(`  ... Retry attempt ${attempts}/${maxRetries} for ${fileName} ...`);
                // 简单的指数退避：重试前等待 2秒 * 次数
                await new Promise(resolve => setTimeout(resolve, 2000 * attempts));
            }
            let operation = await this.client.fileSearchStores.uploadToFileSearchStore({
                file: filePath,
                fileSearchStoreName: this.storeName,
                config: {
                    displayName: fileName,
                    mimeType: mimeType
                }
            });
    
            process.stdout.write(`  - Indexing`);
            while (!operation.done) {
                process.stdout.write('.');
                await new Promise(resolve => setTimeout(resolve, 5000));
                operation = await this.client.operations.get({ operation: operation });
            }
            console.log(` [Done]`);
            uploadSuccess = true;
          } catch (e: any) {
            attempts++;
            console.error(`\n  -> Error uploading ${fileName}: ${e.message}`);

            if (attempts > maxRetries) {
              console.error(`  -> Failed after ${maxRetries} retries. Skipping file.`);
            }
          }
      }
    }
  }

  /**
   * 查询逻辑
   */
  async queryDocuments(query: string, topK: number): Promise<Document[]> {
    if (!this.storeName) await this.init();
    if (!this.storeName) return [];

    try {
      const response = await this.client.models.generateContent({
        model: this.modelName,
        contents: `Find information related to: "${query}". Return relevant excerpts.`,
        config: {
          tools: [{
            fileSearch: {
              fileSearchStoreNames: [this.storeName]
            }
          }]
        }
      });

      const candidate = response.candidates?.[0];
      const groundingMetadata = candidate?.groundingMetadata;
      
      if (!groundingMetadata?.groundingChunks) return [];

      return groundingMetadata.groundingChunks.map((chunk: any, index: number) => ({
        id: `google-${index}`,
        content: chunk.retrievedContext?.parts?.[0]?.text || "",
        metadata: { source: chunk.retrievedContext?.title || "google" },
        similarity: 0.95
      })).slice(0, topK);
    } catch (error) {
      console.error("Query error:", error);
      return [];
    }
  }

  async addDocuments(documents: Document[]): Promise<void> { console.log("Use seed()"); }

  private getMimeType(fileName: string): string | null {
    const ext = path.extname(fileName).toLowerCase();
    const map: Record<string, string> = {
      // Application Types
      '.json': 'application/json',
      '.pdf': 'application/pdf',
      '.ts': 'application/typescript', // mapped from application/typescript
      '.js': 'application/javascript', // mapped from text/javascript or application/ecmascript
      '.dart': 'application/dart',
      '.java': 'text/x-java', // or application/ms-java
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.ppt': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation', // assumed
      '.xml': 'application/xml', // or text/xml
      '.zip': 'application/zip',
      '.sql': 'application/sql',
      '.sh': 'application/x-sh', // or text/x-sh
      '.zsh': 'application/x-zsh',
      '.tex': 'application/x-tex', // or text/x-tex
      '.php': 'application/x-php', // or text/x-php

      // Text Types
      '.txt': 'text/plain',
      '.md': 'text/markdown',
      '.csv': 'text/csv',
      '.html': 'text/html',
      '.htm': 'text/html',
      '.css': 'text/css',
      '.rtf': 'text/rtf',
      '.yaml': 'text/yaml',
      '.yml': 'text/yaml',
      '.py': 'text/x-python',
      '.c': 'text/x-c',
      '.cpp': 'text/x-c++src',
      '.h': 'text/x-chdr',
      '.cs': 'text/x-csharp',
      '.go': 'text/x-go',
      '.rs': 'text/x-rust',
      '.rb': 'text/x-ruby-script',
      '.lua': 'text/x-lua',
      '.swift': 'text/x-swift',
      '.kt': 'text/x-kotlin',
      '.scala': 'text/x-scala',
      '.pl': 'text/x-perl',
      '.r': 'text/x-r-markdown', // or text/x-rsrc
      '.vbs': 'text/x-vbasic'
    };

    return map[ext] || null;
  }

  /**
   * 同步更新 project.md 中的文件名引用
   * 解决文件重命名后，项目元数据不同步导致文件被系统认为丢失的问题
   */
  private async syncProjectMetadata(knowledgeDirPath: string, oldName: string, newName: string): Promise<void> {
    try {
      // 知识库文件路径是 output/project/{name}/knowledge/
      // project.md 在 ../project.md
      const projectMdPath = path.join(knowledgeDirPath, '..', 'project.md');
      
      // 检查文件是否存在
      try {
        await fs.access(projectMdPath);
      } catch {
        console.warn(`  -> Warning: project.md not found at ${projectMdPath}, skipping metadata sync.`);
        return;
      }

      const content = await fs.readFile(projectMdPath, 'utf-8');
      
      // 简单的全量替换。由于文件名通常包含扩展名，且在列表中有特定格式，
      // 全局替换通常是安全的。使用 replaceAll 确保替换所有出现的地方。
      // 注意：replaceAll 需要 Node.js 15+
      const newContent = content.split(oldName).join(newName);

      if (content !== newContent) {
        await fs.writeFile(projectMdPath, newContent, 'utf-8');
        console.log(`  -> Updated project.md reference: "${oldName}" -> "${newName}"`);
      }
    } catch (error) {
      console.error(`  -> Failed to update project.md:`, error);
      // 即使元数据更新失败，也不应阻断上传流程，但确实会留下隐患
    }
  }
}