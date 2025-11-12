// lib/db/pg/index.ts
import { Pool } from 'pg';
import fs from 'fs/promises';
import path from 'path';
import { DataAccess, Document } from '../core/interface';
import pool from './client';
import { universalChunker } from '../core/chunker';
import { default as pgvectorCore } from 'pgvector'; // 用于 toSql
import { default as pgvectorPG } from 'pgvector/pg'; // 用于 registerType

// --- 将所有配置和辅助函数集中到这里 ---
const OLLAMA_API_URL = 'http://localhost:11434/api/embeddings';
const OLLAMA_MODEL = 'nomic-embed-text:latest';
const EMBEDDING_DIMENSIONS = 768;

/**
 * 使用 Ollama 生成向量，并根据 nomic-embed-text 的最佳实践添加任务前缀。
 * @param text 要向量化的文本
 * @param task 'search_query' | 'search_document' - 明确指定任务类型
 * @returns 向量数组
 */
async function getOllamaEmbedding(
  text: string,
  task: 'search_query' | 'search_document'
): Promise<number[]> {

  // 根据任务类型，为 prompt 添加官方推荐的前缀
  const prefixedText = `${task}: ${text}`;

  const response = await fetch(OLLAMA_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // 使用添加了前缀的文本
    body: JSON.stringify({ model: OLLAMA_MODEL, prompt: prefixedText }),
  });

  if (!response.ok) throw new Error(`Ollama API request failed: ${response.statusText}`);
  const data = await response.json() as { embedding: number[] };
  return data.embedding;
}

// 简单的按照2000个字符为一个块的切分策略(效果很差)
function chunkText(text: string, chunkSize = 2000, overlap = 400): string[] {
    const chunks: string[] = [];
    let i = 0;
    while (i < text.length) {
      const end = Math.min(i + chunkSize, text.length);
      chunks.push(text.slice(i, end));
      i += chunkSize - overlap;
      if (end === text.length) break;
    }
    return chunks;
}


export class PostgresDB implements DataAccess {
  private pool: Pool = pool;

  async init(): Promise<void> {
    try {
      const client = await this.pool.connect();
      try {
        await this.pool.query('SELECT NOW()');
        console.log('PostgreSQL connected successfully.');
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Failed to initialize PostgreSQL connection:', error);
      throw error;
    }
  }

  async migrate(): Promise<void> {
    console.log('--- Running PostgreSQL migrations ---');
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('CREATE EXTENSION IF NOT EXISTS vector;');
      await pgvectorPG.registerType(client);
      
      await client.query(`
        CREATE TABLE IF NOT EXISTS knowledge_files (
          id SERIAL PRIMARY KEY,
          file_name VARCHAR(255) UNIQUE NOT NULL,
          content TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);
      await client.query(`
        CREATE TABLE IF NOT EXISTS knowledge_chunks (
          id SERIAL PRIMARY KEY,
          file_id INTEGER NOT NULL REFERENCES knowledge_files(id) ON DELETE CASCADE,
          chunk_text TEXT NOT NULL,
          embedding VECTOR(${EMBEDDING_DIMENSIONS})
        );
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_embedding_cos 
        ON knowledge_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
      `);
      
      await client.query('COMMIT');
      console.log('--- Migrations completed successfully ---');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Migration failed:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async seed(directoryPath: string): Promise<void> {
    console.log('--- Starting PostgreSQL knowledge base seeding ---');
    const client = await this.pool.connect();
    try {
      console.log('Clearing old knowledge base data...');
      await client.query('TRUNCATE TABLE knowledge_files CASCADE;');

      const files = await fs.readdir(directoryPath);
      console.log(`Found ${files.length} files. Processing...`);

      for (const fileName of files) {
        if (path.extname(fileName) !== '.txt') continue;
        
        const content = await fs.readFile(path.join(directoryPath, fileName), 'utf-8');
        const insertFileRes = await client.query(
          'INSERT INTO knowledge_files (file_name, content) VALUES ($1, $2) RETURNING id',
          [fileName, content]
        );
        const fileId = insertFileRes.rows[0].id;
        // const chunks = chunkText(content);
        const chunks = await universalChunker(content);
        console.log(`  - Split ${fileName} into ${chunks.length} high-quality chunks.`);

        for (const chunk of chunks) {
          const embedding = await getOllamaEmbedding(chunk, 'search_document');
          await client.query(
            'INSERT INTO knowledge_chunks (file_id, chunk_text, embedding) VALUES ($1, $2, $3)',
            [fileId, chunk, pgvectorCore.toSql(embedding)]
          );
        }
        console.log(`  - Successfully processed ${fileName}`);
      }
    } catch (error) {
      console.error('Seeding failed:', error);
      throw error;
    } finally {
      client.release();
      console.log('--- PostgreSQL seeding finished ---');
    }
  }

  async addDocuments(documents: Document[]): Promise<void> {
    console.log(`(Placeholder) Adding ${documents.length} documents to PostgreSQL.`);
    // TODO: 实现单个文档的添加逻辑，类似 seed
    return Promise.resolve();
  }

  // 向量搜索
  async queryDocuments(query: string, topK: number): Promise<Document[]> {
    console.log(`Querying PostgreSQL with vector search for: "${query}"`);
    try {
      const queryEmbedding = await getOllamaEmbedding(query, 'search_query');
      // const queryVector = JSON.stringify(queryEmbedding);

      // 使用 <=> 操作符进行余弦距离搜索
      // 距离越小，相似度越高
      const searchResult = await this.pool.query(
        `SELECT
          id::text,
          chunk_text AS content,
          json_build_object('file_id', file_id) AS metadata,
          1 - (embedding <=> $1::vector) AS similarity
         FROM knowledge_chunks
         ORDER BY similarity DESC
         LIMIT $2`,
        [pgvectorCore.toSql(queryEmbedding), topK]
      );

      console.log(`Found ${searchResult.rowCount} similar chunks.`);
      return searchResult.rows;
    } catch (error) {
        console.error('Error during vector search in PostgreSQL:', error);
        return [];
    }
  }
}