// lib/db/chroma/index.ts
import { Collection, EmbeddingFunction } from 'chromadb';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid'; // 用于生成唯一的文档 ID

import { DataAccess, Document } from '../core/interface';
import client from './client';
import { universalChunker } from '../core/chunker';
import { getEmbedding, getEmbeddings } from '../core/embed-config';

class OllamaEmbeddingFunction implements EmbeddingFunction {
  // ChromaDB 批量向量化文本
  public async generate(texts: string[]): Promise<number[][]> {
    return getEmbeddings(texts);
  }
}

export class ChromaDB implements DataAccess {
  private collection!: Collection;
  private collectionName = "knowledge_base"; // 定义 collection 名称

  async init(): Promise<void> {
    // init 的职责保持不变，获取或创建 collection
    // 我们将在这里注入自定义的 Ollama Embedding 函数
    try {
      this.collection = await client.getOrCreateCollection({
        name: this.collectionName,
        embeddingFunction: new OllamaEmbeddingFunction(),
        // 指定元数据，设置距离计算方法
        metadata: { "hnsw:space": "cosine" },
      });
      console.log('ChromaDB connected and collection is ready.');
    } catch (error) {
      console.error('Failed to initialize ChromaDB:', error);
      throw error;
    }
  }

  async migrate(): Promise<void> {
    // 对于 ChromaDB，"migrate" 相当于确保 Collection 存在。
    // 如果 Collection 已存在，我们先删除它，以确保一个干净的开始状态。
    console.log('--- Running ChromaDB migrations ---');
    try {
      await client.deleteCollection({ name: this.collectionName });
      console.log(`- Old collection "${this.collectionName}" deleted.`);
    } catch (error: any) {
      // 如果 collection 不存在，delete会报错，这是正常现象，我们忽略它。
      if (!error.message.includes("does not exist")) {
         throw error;
      }
    }
    this.collection = await client.getOrCreateCollection({
        name: this.collectionName,
        embeddingFunction: new OllamaEmbeddingFunction(),
        metadata: { "hnsw:space": "cosine" },
    });
    console.log(`- Collection "${this.collectionName}" created/ensured.`);
    console.log('--- ChromaDB migrations completed successfully ---');
  }

  async seed(directoryPath: string): Promise<void> {
    console.log('--- Starting ChromaDB knowledge base seeding ---');
    if (!this.collection) {
      throw new Error("ChromaDB collection is not initialized. Run migrate first.");
    }
    
    const files = await fs.readdir(directoryPath);
    console.log(`Found ${files.length} files. Processing...`);

    for (const fileName of files) {
      if (path.extname(fileName) !== '.txt') continue;

      const content = await fs.readFile(path.join(directoryPath, fileName), 'utf-8');

      const chunks = await universalChunker(content);
      console.log(`  - Split ${fileName} into ${chunks.length} high-quality chunks.`);

      if (chunks.length === 0) continue;

      // 为每个 chunk 创建元数据和唯一的 ID
      const metadatas = chunks.map((_, index) => ({
        fileName: fileName,
        chunkNumber: index + 1,
      }));
      const ids = chunks.map(() => uuidv4());

      // 批量添加到 ChromaDB
      // 注意：我们只提供 documents，ChromaDB 会自动使用我们
      // 在 init 中配置的 OllamaEmbeddingFunction 来生成向量。
      await this.collection.add({
        ids: ids,
        documents: chunks,
        metadatas: metadatas,
      });
      console.log(`  - Successfully embedded and stored chunks for ${fileName}.`);
    }
    console.log('--- ChromaDB seeding finished ---');
  }
  
  async queryDocuments(query: string, topK: number): Promise<Document[]> {
    console.log(`Querying ChromaDB for: "${query}"`);
    if (!this.collection) {
      throw new Error("ChromaDB collection is not initialized.");
    }

    try {
      const queryEmbedding = await getEmbedding(query, 'search_query');
      const results = await this.collection.query({
        queryEmbeddings: [queryEmbedding],  // <-- 提供查询文本
        nResults: topK,
        // 可以在这里添加基于元数据的过滤条件
        // where: { "fileName": "some_file.txt" } 
      });

      // 将 ChromaDB 的返回格式转换为我们的通用 Document 格式
      const documents: Document[] = [];
      if (results.ids[0]) {
        for (let i = 0; i < results.ids[0].length; i++) {
          // 相似度计算方式
          // 当 collection 使用 "cosine" 距离时, results.distances[i] 返回的是余弦距离。
          // 范围是 [0, 2]。
          // 用和 PGVector 完全相同的公式来转换为相似度。
          const cosineDistance = results.distances[0]?.[i] ?? 2; // 默认给最大距离
          const cosineSimilarity = 1 - cosineDistance;
          documents.push({
            id: results.ids[0][i],
            content: results.documents[0]?.[i] ?? '',
            metadata: results.metadatas[0]?.[i] ?? {},
            // ChromaDB 的 query 方法返回的是距离 (distance)，不是相似度。
            // 距离越小越好。我们可以把它转换为一个伪相似度。
            // L2 距离的范围是 [0, infinity)，这里简单用 1 / (1 + distance) 转换。
            similarity: cosineSimilarity,
          });
        }
      }
      return documents;
    } catch(error: any) {
      console.error('Error during ChromaDB query:', error);
      throw error;
    }
  }

  // addDocuments 的占位符实现
  async addDocuments(documents: Document[]): Promise<void> {
    console.log(`(Placeholder) Adding ${documents.length} documents to ChromaDB.`);
    return Promise.resolve();
  }
}