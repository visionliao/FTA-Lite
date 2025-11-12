// lib/db/core/chunker.ts
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

// 默认分块配置
const DEFAULT_CHUNK_SIZE = 800;
const DEFAULT_CHUNK_OVERLAP = 200; // 重叠部分200，以减少冗余

// 针对 QA 格式的特殊、更优配置
const QA_CHUNK_SIZE = 1500; // 增大尺寸，确保即使较长的QA对也不会被错误合并
const QA_CHUNK_OVERLAP = 0; // QA对之间是独立的，不需要重叠

/**
 * 一个通用的、高质量的文本分块器，适用于任何类型的文本。
 * 它使用 RecursiveCharacterTextSplitter 策略，优先按段落、句子等语义边界分割。
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
  const doubleNewlinePattern = /\n\s*\n/g;

  const qaMatches = (normalizedContent.match(qaPattern) || []).length;
  const paragraphMatches = (normalizedContent.match(doubleNewlinePattern) || []).length;

  // 如果 QA 标记很多，并且段落也很多，我们优先使用 QA 策略
  if (qaMatches > 5 && paragraphMatches > 5) {
    console.log(`  - [Chunker] Detected QA-like structure. Applying paragraph splitting strategy.`);
    // 对于 QA 文件，最有效的分割器就是最简单的：按双换行符分割。
    // RecursiveCharacterTextSplitter 在这种场景下反而会过度思考。
    const chunks = normalizedContent.split(doubleNewlinePattern).filter(p => p.trim() !== '');
    // 我们可以对过长的 QA 对做一个兜底处理
    const finalChunks: string[] = [];
    for (const chunk of chunks) {
        if (chunk.length > QA_CHUNK_SIZE) {
            // 如果某个QA对本身就超长，再用 Recursive 分割器处理它
            const splitter = new RecursiveCharacterTextSplitter({ chunkSize: QA_CHUNK_SIZE, chunkOverlap: 100 });
            finalChunks.push(...await splitter.splitText(chunk));
        } else {
            finalChunks.push(chunk);
        }
    }
    return finalChunks.filter(chunk => chunk.trim().length > 10);
  }

  // --- 默认策略：使用 RecursiveCharacterTextSplitter ---
  console.log(`  - [Chunker] Applying default recursive splitting strategy.`);
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: DEFAULT_CHUNK_SIZE,
    chunkOverlap: DEFAULT_CHUNK_OVERLAP,
  });

  // 使用分割器处理文本
  const chunks = await splitter.splitText(normalizedContent);
  // 可以在这里添加一些后处理逻辑，比如过滤掉太短的、无意义的块
  return chunks.filter(chunk => chunk.trim().length > 10);
}