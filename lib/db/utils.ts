// lib/db/utils.ts

/**
 * 清理和规范化文本，用于存储或查询。
 * @param text 输入文本
 * @returns 清理后的文本
 */
export function sanitizeText(text: string): string {
  // 移除多余的空格，转换为小写等
  return text.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * 一个简单的异步函数重试包装器
 * @param fn 要执行的异步函数
 * @param retries 重试次数
 * @param delay 每次重试之间的延迟（毫秒）
 * @returns 
 */
export async function retryAsync<T>(
  fn: () => Promise<T>, 
  retries = 3, 
  delay = 1000
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries > 0) {
      console.log(`Operation failed. Retrying in ${delay}ms... (${retries} retries left)`);
      await new Promise(res => setTimeout(res, delay));
      return retryAsync(fn, retries - 1, delay);
    }
    throw error;
  }
}