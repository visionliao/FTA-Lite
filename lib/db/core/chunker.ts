// lib/db/core/chunker.ts
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

// 针对 QA 格式的特殊、更优配置
const QA_CHUNK_SIZE = 1500; // 增大尺寸，确保即使较长的QA对也不会被错误合并
const QA_CHUNK_OVERLAP = 0; // QA对之间是独立的，不需要重叠

// 针对使用单换行符分隔的半结构化文本的配置
const STRUCTURED_CHUNK_SIZE = 2000;
const STRUCTURED_CHUNK_OVERLAP = 400; // 保留一些重叠以连接上下文

// 默认分块配置
const DEFAULT_CHUNK_SIZE = 1200;
const DEFAULT_CHUNK_OVERLAP = 200; // 重叠部分200，以减少冗余

/**
 * 一个通用的、高质量的文本分块器，适用于任何类型的文本。
 * 按顺序尝试以下策略：
 * 1. QA 格式检测与分割
 * 2. 半结构化文本检测与分割 (按空行分割)
 * 3. 默认 RecursiveCharacterTextSplitter 策略
 * @param content 任何字符串形式的文本内容。
 * @returns 一个字符串数组，每个元素都是一个文本块。
 */
export async function universalChunker(content: string): Promise<string[]> {
  // 在分块前，统一处理换行符
  // 这能自动适应 Windows (CRLF) 和 Linux/macOS (LF) 的文件
  const normalizedContent = content.replace(/\r\n/g, '\n');

  // --- 策略探测：检查文本是否符合 QA 格式 ---
  // 我们定义一个简单的规则：如果文本中包含超过 5 个 "Q:" 或 "A:"，
  // 并且这些问答对之间由双换行符分隔，我们就认为它是 QA 格式。
  const qaPattern = /(Q:|A:|问：|答：)/g;
  const doubleNewlinePattern = /\n\s*\n/g; // 匹配至少一个空行

  const qaMatches = (normalizedContent.match(qaPattern) || []).length;
  const paragraphMatches = (normalizedContent.match(doubleNewlinePattern) || []).length;

  // 如果 QA 标记很多，并且段落也很多，我们优先使用 QA 策略
  if (qaMatches > 5 && paragraphMatches > 5) {
    console.log(`  - [Chunker] Strategy 1: Detected QA-like structure. Applying paragraph splitting.`);
    // 分割
    const chunks = normalizedContent.split(doubleNewlinePattern);
    // 对过长的 QA 对做一个兜底处理
    const finalChunks: string[] = [];
    for (const chunk of chunks) {
      // 清理和非空判断
      const trimmedChunk = chunk.trim();
      if (trimmedChunk === '') continue;

      if (trimmedChunk.length > QA_CHUNK_SIZE) {
          // 如果某个QA对本身就超长，再用 Recursive 分割器处理它
          const splitter = new RecursiveCharacterTextSplitter({ chunkSize: QA_CHUNK_SIZE, chunkOverlap: 100 });
          const subChunks = await splitter.splitText(trimmedChunk);
          finalChunks.push(...subChunks.map(sc => sc.trim()).filter(sc => sc !== ''));
      } else {
          finalChunks.push(trimmedChunk);
      }
    }
    return finalChunks.filter(chunk => chunk.trim().length > 10);
  }

  // 使用预设的一个空行进行分块(一个文本中出现至少3个空行)
  if (paragraphMatches >= 3) {
    console.log(`  - [Chunker] Strategy 2: Detected paragraph structure. Applying paragraph splitting as a high-priority default.`);
    // 分割
    const chunks = normalizedContent.split(doubleNewlinePattern);
    const finalChunks: string[] = [];
    const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: STRUCTURED_CHUNK_SIZE,
        chunkOverlap: STRUCTURED_CHUNK_OVERLAP,
    });
    for (const chunk of chunks) {
      // 清理无意义的数据
      const trimmedChunk = chunk.trim();
      if (trimmedChunk === '') continue;

      // 长度检查和二次分割
      if (trimmedChunk.length > STRUCTURED_CHUNK_SIZE) {
        console.log(`    - A paragraph chunk is too long (${trimmedChunk.length} > ${STRUCTURED_CHUNK_SIZE}), applying recursive splitting to it.`);
        const subChunks = await splitter.splitText(trimmedChunk);
        finalChunks.push(...subChunks.map(sc => sc.trim()).filter(sc => sc !== ''));
      } else {
        finalChunks.push(trimmedChunk);
      }
    }
    return finalChunks.filter(chunk => chunk.trim().length > 10);
  }

  // --- 默认策略：使用 RecursiveCharacterTextSplitter ---
  console.log(`  - [Chunker] Strategy 3: Applying default recursive splitting as a final fallback.`);
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: DEFAULT_CHUNK_SIZE,
    chunkOverlap: DEFAULT_CHUNK_OVERLAP,
  });

  // 使用分割器处理文本
  const chunks = await splitter.splitText(normalizedContent);
  // 过滤掉太短的、无意义的块
  return chunks.map(chunk => chunk.trim()).filter(chunk => chunk !== '' && chunk.length > 10);
}