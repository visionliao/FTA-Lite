// lib/llm/tools/tool-client-manager.ts

import { ToolClient } from './tool-client';

// 使用 Map 来存储不同 serverUrl 对应的单例
// Key: serverUrl (string), Value: ToolClient instance
const toolClientInstances = new Map<string, ToolClient>();

/**
 * 获取 ToolClient 的单例实例。
 * 如果给定 serverUrl 的实例不存在，则会创建一个新实例并缓存。
 * @param serverUrl MCP 服务器的 URL。
 * @returns 对应 URL 的 ToolClient 实例。
 */
export function getToolClientInstance(serverUrl: string): ToolClient {
  if (!serverUrl) {
    throw new Error('A server URL must be provided to get a ToolClient instance.');
  }
  const normalizeServerUrl = serverUrl.replace(/\/+$/, '');

  // 检查缓存中是否已有实例
  if (!toolClientInstances.has(normalizeServerUrl)) {
    console.log(`--- [ToolClientManager] Creating new ToolClient instance for: ${normalizeServerUrl} ---`);
    const newInstance = new ToolClient(normalizeServerUrl);
    toolClientInstances.set(normalizeServerUrl, newInstance);
  } else {
    console.log(`--- [ToolClientManager] Reusing existing ToolClient instance for: ${normalizeServerUrl} ---`);
  }

  // 从 Map 中返回实例（此时必定存在）
  return toolClientInstances.get(normalizeServerUrl)!;
}