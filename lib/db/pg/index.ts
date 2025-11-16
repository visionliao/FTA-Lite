// lib/db/pg/index.ts
import { Pool } from 'pg';
import fs from 'fs/promises';
import path from 'path';
import { DataAccess, Document } from '../core/interface';
import pool from './client';
import { universalChunker } from '../core/chunker';
import { default as pgvectorCore } from 'pgvector'; // 用于 toSql
import { default as pgvectorPG } from 'pgvector/pg'; // 用于 registerType
import { getEmbedding, getModelDimensions } from '../core/embed-config';

export class PostgresDB implements DataAccess {
  private pool: Pool = pool;
  private embeddingModel: string;
  private embeddingDimensions: number;

  constructor(embeddingModel?: string) {
    this.embeddingModel = embeddingModel || process.env.EMBEDDING_MODEL_TYPE!;
    this.embeddingDimensions = getModelDimensions(this.embeddingModel);
    console.log(`PostgresDB instance created for embedding model: ${this.embeddingModel} (${this.embeddingDimensions} dimensions)`);
  }

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

      // 在创建前先彻底删除旧表，以确保向量维度发生变化(表结构变化)导致的失败
      // 使用 CASCADE 会自动删除依赖于这些表的其他对象（如 knowledge_chunks 的外键）
      console.log('Dropping old knowledge base tables to ensure a clean slate...');
      await client.query('DROP TABLE IF EXISTS knowledge_files CASCADE;');
      await client.query('DROP TABLE IF EXISTS knowledge_chunks CASCADE;');
      console.log('Old tables dropped successfully.');

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
          embedding VECTOR(${this.embeddingDimensions})
        );
      `);
      if (this.embeddingDimensions <= 2000) {
        // ivfflat 是一种非常高效的索引，硬性限制：它不支持维度超过 2000 的向量。
        // IVFFlat 的优势:
        // 构建速度快 - 索引构建时间比 HNSW 短
        // 内存占用小 - 相比 HNSW 占用更少的内存
        // 适合超大规模数据 - 在千万级以上的数据量时,IVFFlat 的性能优势更明显

        // await client.query(`
        //   CREATE INDEX IF NOT EXISTS idx_embedding_cos
        //   ON knowledge_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
        // `);

        // 创建 HNSW 索引，HNSW 通常在准确率和查询速度之间能提供更好的平衡，尤其是在中等规模的数据集上。
        // 硬性限制：它不支持维度超过 2000 的向量。
        // HNSW 的优势:
        // 1. 查询准确率更高 - HNSW 是一种图结构索引,能提供接近精确搜索的结果
        // 2. 查询速度稳定 - 不需要像 IVFFlat 那样先聚类再搜索,查询延迟更可预测
        // 3. 无需调参 - 开箱即用,不需要像 IVFFlat 那样调整 lists 参数
        // 4. 适合中小规模数据 - 在几十万到百万级别的向量数据上表现优异
        console.log(`Vector dimension (${this.embeddingDimensions}) is within the index limit. Creating HNSW index...`);
        await client.query(`
          CREATE INDEX ON knowledge_chunks USING hnsw (embedding vector_cosine_ops);
        `);
      } else {
        // 当维度超过2000时，打印警告并跳过索引创建
        console.warn('\n--------------------------------------------------------------------');
        console.warn(`[INDEX WARNING] Vector dimension (${this.embeddingDimensions}) exceeds the 2000 limit of the current environment's pgvector index implementation.`);
        console.warn('Skipping index creation to prevent migration failure.');
        console.warn('Vector search will perform an exact, unindexed scan, which may be slow on large datasets.');
        console.warn('--------------------------------------------------------------------\n');
      }

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
        if (path.extname(fileName) !== '.md' && path.extname(fileName) !== '.txt') continue;
        
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
          const embedding = await getEmbedding(chunk, 'search_document', this.embeddingModel);
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
      const queryEmbedding = await getEmbedding(query, 'search_query', this.embeddingModel);
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