// lib/llm/vercel-ai-provider.ts
import { 
  streamText, 
  generateText, 
  LanguageModel,
  stepCountIs,
  jsonSchema,
  wrapLanguageModel,
  extractReasoningMiddleware
} from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { ChatMessage, ToolCall, TokenUsage, DurationUsage, StreamingResult, LlmProviderResponse, BaseProviderConfig } from './types';
import { McpToolSchema } from './tools/tool-client';
import { getToolClientInstance } from './tools/tool-client-manager';
import { appendToLogFile } from '@/lib/server-utils';

/**
 * 统一的 LLM 提供商，使用 Vercel AI SDK 处理所有模型
 */
export class VercelAIProvider {
  private providerName: string;
  private apiKey: string;
  private proxyUrl?: string;
  private logPath?: string;

  constructor(providerName: string, apiKey: string, proxyUrl?: string) {
    this.providerName = providerName;
    this.apiKey = apiKey;
    this.proxyUrl = proxyUrl;
  }

  /**
   * 根据 provider 和 config 创建 Vercel AI SDK 的模型实例
   */
  private createModelInstance(modelName: string): LanguageModel {
    const providerKey = this.providerName.toLowerCase();

    switch (providerKey) {
      // google gemini
      case 'google':
        return createGoogleGenerativeAI({ apiKey: this.apiKey })(modelName);

      // anthropic
      case 'anthropic':
        const anthropicProvider = createAnthropic({
          apiKey: this.apiKey,
          baseURL: this.proxyUrl, // 可选,用于代理
        });
        return anthropicProvider(modelName);

      // deepseek
      case 'deepseek':
        const deepseekAsOpenAI = createOpenAI({
          baseURL: this.proxyUrl,
          apiKey: this.apiKey,
        });
        // 直接返回模型实例，不需要任何 hack
        return deepseekAsOpenAI.chat(modelName);

        // const deepseekProvider = createDeepSeek({
        //   apiKey: this.apiKey,
        //   baseURL: this.proxyUrl, // 可选,用于代理
        // });
        // return deepseekProvider(modelName);

      // ollama本地模型
      case 'ollama':
        // 使用OpenAI兼容模式访问Ollama
        // 确保使用正确的Ollama OpenAI兼容端点
        const ollamaBaseURL = (this.proxyUrl || 'http://127.0.0.1:11434') + '/v1';
        console.log(`[VercelAIProvider] Creating Ollama model with baseURL: ${ollamaBaseURL}`);
        const openaiProvider = createOpenAI({
          baseURL: ollamaBaseURL,
          apiKey: this.apiKey || 'ollama' // Ollama不需要真实API key
        });
        const baseModel = openaiProvider.chat(modelName);
        // 使用中间件包装模型以提取推理内容
        return wrapLanguageModel({
          model: baseModel,
          middleware: extractReasoningMiddleware({ tagName: 'think' })
        });

      // OpenAI
      case 'openai':
        return createOpenAI({ baseURL: this.proxyUrl, apiKey: this.apiKey })(modelName);

      // 所有兼容 OpenAI 的其他国产模型 (包括 deepseek, moonshot, zhipu, qwen 等)
      default:
        const otherModelProvider = createOpenAI({
          baseURL: this.proxyUrl,
          apiKey: this.apiKey,
        });
        return otherModelProvider.chat(modelName);
    }
  }

  /**
   * 将自定义的工具 schema 格式映射到 Vercel AI SDK 需要的格式
   */
  private mapMcpToolsToSdkTools(
    tools: McpToolSchema[],
    mcpServerUrl: string
  ): Record<string, any> {
    const toolSet: Record<string, any> = {};
    for (const t of tools) {
      toolSet[t.function.name] = {
        description: t.function.description,
        // 使用 jsonSchema() 包装,传递一个返回 schema 的函数
        inputSchema: jsonSchema(() => t.function.parameters),
        execute: async (input: Record<string, unknown>) => {
          const toolStartTime = Date.now();
          console.log(`\n[Tool Execution] 调用工具: ${t.function.name}`);
          console.log(`[Tool Execution] 工具参数:`, JSON.stringify(input, null, 2));
          if (this.logPath) {
            const sendMessages = JSON.stringify(input, null, 2);
            await appendToLogFile(this.logPath, `--- 工具调用 ---\n${sendMessages}\n\n`);
          }

          const toolClient = getToolClientInstance(mcpServerUrl);
          const result = await toolClient.callTool(t.function.name, input);

          const toolDuration = Date.now() - toolStartTime;
          console.log(`[Tool Execution] 工具返回结果:`, JSON.stringify(result, null, 2));
          console.log(`[Tool Execution] 工具 ${t.function.name} 执行完成，耗时：${toolDuration}ms\n`);
          if (this.logPath) {
            const sendMessages = JSON.stringify(result, null, 2);
            await appendToLogFile(this.logPath, `--- 工具调用结果 ---\n${sendMessages}\n\n`);
          }

          return result;
        },
      };
    }
    return toolSet;
  }

  /**
   * 将我们自定义的 ChatMessage[] 格式映射到 Vercel AI SDK 需要的消息格式
   */
  private mapMessagesToSdkFormat(messages: ChatMessage[]): any[] {
    return messages.map(msg => {
      if (msg.role === 'tool') {
        return {
          role: 'tool' as const,
          content: [{ type: 'tool-result' as const, toolCallId: msg.tool_call_id!, result: msg.content! }]
        };
      }
      if (msg.role === 'assistant' && msg.tool_calls) {
        const content: any[] = [];
        // 如果原始消息里有 reasoning（推理内容），必须带上
        if ((msg as any).reasoning) {
          content.push({ type: 'text', text: (msg as any).reasoning });
        } else if (typeof msg.content === 'string' && msg.content) {
          content.push({ type: 'text', text: msg.content });
        }
        content.push({
          type: 'tool-calls' as const,
          toolCalls: msg.tool_calls.map(tc => ({
            toolCallId: tc.id,
            toolName: tc.function.name,
            args: JSON.parse(tc.function.arguments)
          }))
        });

        return {
          role: 'assistant' as const,
          content: content
        };
      }
      return { role: msg.role, content: msg.content };
    });
  }

  /**
   * 将 Vercel SDK 的结果适配回我们自己的 LlmProviderResponse 格式
   */
  private async adaptVercelResponse(result: any, totalDuration: number): Promise<LlmProviderResponse> {
    const usage: TokenUsage = {
      prompt_tokens: (result.totalUsage as any)?.inputTokens || 0,
      completion_tokens: (result.totalUsage as any)?.outputTokens || 0,
      reasoning_tokens: (result.totalUsage as any)?.reasoningTokens || 0,
      cachedInput_tokens: (result.totalUsage as any)?.cachedInputTokens || 0,
      total_tokens: (result.totalUsage as any)?.totalTokens || 0,
    };

    const duration: DurationUsage = {
      total_duration: totalDuration,
      load_duration: 0,
      prompt_eval_duration: 0,
      eval_duration: 0,
    };

    const toolCalls: ToolCall[] | undefined = result.toolCalls?.map((tc: any) => ({
      id: tc.toolCallId,
      type: 'function',
      function: { name: tc.toolName, arguments: JSON.stringify(tc.args) },
    }));

    // 推理内容会在 result.reasoning 中
    if (result.reasoning) {
      console.log('[大模型思考内容]:', result.reasoning);
      if (this.logPath && result.reasoning.length > 10) {
        const sendMessages = JSON.stringify(result.reasoning, null, 2);
        await appendToLogFile(this.logPath, `--- 思考过程 ---\n${sendMessages}\n\n`);
      }
    }

    return {
      content: result.text || null, // text 现在不包含 <think> 标签
      tool_calls: toolCalls,
      usage: usage,
      duration: duration
    };
  }

  /**
   * @description 将通用配置转换为Vercel AI SDK所需的参数格式
   * @param messages 聊天消息
   * @param options 包含所有配置的 BaseProviderConfig 对象
   * @returns 准备好用于 streamText/generateText 的参数对象
   */
  private async prepareSdkParams(messages: ChatMessage[], options: BaseProviderConfig): Promise<any> {
    // 1. 获取并映射工具
    let sdkTools: Record<string, any> | undefined;
    if (options.mcpServerUrl) {
      try {
        const toolClient = getToolClientInstance(options.mcpServerUrl);
        const mcpTools = await toolClient.getToolsSchema(); // 工具获取逻辑移到这里
        if (mcpTools && mcpTools.length > 0) {
          sdkTools = this.mapMcpToolsToSdkTools(mcpTools, options.mcpServerUrl);
        }
      } catch (error) {
        console.error("[VercelAIProvider] Failed to get tools schema, proceeding without tools.", error);
      }
    }

    // 2. 组装最终的参数对象
    const sdkParams: any = {
      tools: sdkTools,
      system: options.systemPrompt,
      messages: this.mapMessagesToSdkFormat(messages),
      temperature: options.temperature,
      topP: options.topP,
      presencePenalty: options.presencePenalty,
      frequencyPenalty: options.frequencyPenalty,
      maxTokens: options.maxOutputTokens,
      maxToolCalls: options.maxToolCalls,
    };
    this.logPath = options.logPath;

    return sdkParams;
  }

  /**
   * 非流式生成
   */
  async generateNonStreaming(
    model: string,
    messages: ChatMessage[],
    options: BaseProviderConfig
  ): Promise<LlmProviderResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs);

    // 记录总开始时间
    const totalStartTime = Date.now();
    try {
      const languageModel = this.createModelInstance(model);

      const generateOptions = await this.prepareSdkParams(messages, options);
      console.log('\n--- [LLM Request Log - Non-Streaming] ---');
      console.log(`Timestamp: ${new Date().toISOString()}`);
      console.log('调用大模型：', model)
      console.log('可用工具个数：', generateOptions.tools ? Object.keys(generateOptions.tools).length : 0)
      console.log('最大工具调用次数：', generateOptions.maxToolCalls)
      console.log('系统提示词：', generateOptions.system || '无')
      console.log('发送给大模型的消息：', generateOptions.messages)
      if (this.logPath) {
        const sendMessages = JSON.stringify(generateOptions.messages, null, 2);
        await appendToLogFile(this.logPath, `--- 发送给大模型的消息 ---\n${sendMessages}\n\n`);
      }
      // console.log('参数配置信息:', JSON.stringify(generateOptions, null, 2));
      console.log('-----------------------------------------\n');

      const result = await generateText({
        model: languageModel,
        ...generateOptions,
        stopWhen: stepCountIs(generateOptions.maxToolCalls), // 最大工具调用次数限制
        signal: controller.signal, // 超时控制
      });

      // 打印工具调用信息
      if (result.toolCalls && result.toolCalls.length > 0) {
        console.log(`\n[Tool Calls Summary] 共调用了 ${result.toolCalls.length} 个工具:`);
        result.toolCalls.forEach((tc: any) => {
          console.log(`  - 工具名称: ${tc.toolName}`);
          console.log(`    工具ID: ${tc.toolCallId}`);
          console.log(`    参数: ${JSON.stringify(tc.args)}`);
        });
      }

      // 打印所有步骤信息
      if (result.steps && result.steps.length > 1) {
        console.log(`\n[Multi-Step Execution] 共执行了 ${result.steps.length} 步`);
        result.steps.forEach((step: any, index: number) => {
          console.log(`  步骤 ${index + 1}:`);
          if (step.toolCalls) {
            console.log(`    - 工具调用: ${step.toolCalls.map((tc: any) => tc.toolName).join(', ')}`);
          }
          if (step.text) {
            console.log(`    - 文本响应: ${step.text.substring(0, 100)}...`);
          }
        });
      }

      const totalDuration = (Date.now() - totalStartTime) * 1e6;
      console.log(`\n总耗时: ${totalDuration}ns`);

      const adaptedResult = await this.adaptVercelResponse(result, totalDuration);
      console.log('大模型回复:', adaptedResult.content || '无');
      return adaptedResult;
    } finally {
      clearTimeout(timeoutId)
    }
  }

  /**
   * 流式生成
   */
  async generateStreaming(
    model: string,
    messages: ChatMessage[],
    options: BaseProviderConfig
  ): Promise<StreamingResult | LlmProviderResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs);

    try {
      const languageModel = this.createModelInstance(model);

      const streamOptions = await this.prepareSdkParams(messages, options);
      console.log('\n--- [LLM Request Log - Streaming] ---');
      console.log(`Timestamp: ${new Date().toISOString()}`);
      console.log('调用大模型：', model)
      console.log('可用工具个数：', streamOptions.tools ? Object.keys(streamOptions.tools).length : 0)
      console.log('最大工具调用次数：', streamOptions.maxToolCalls)
      console.log('系统提示词：', streamOptions.system || '无')
      console.log('发送给大模型的消息：', streamOptions.messages)
      if (this.logPath) {
        const sendMessages = JSON.stringify(streamOptions.messages, null, 2);
        await appendToLogFile(this.logPath, `--- 发送给大模型的消息 ---\n${sendMessages}\n\n`);
      }
      // console.log('参数配置信息:', JSON.stringify(streamOptions, null, 2));
      console.log('-----------------------------------------\n');

      const result = await streamText({
        model: languageModel,
        ...streamOptions,
        stopWhen: stepCountIs(streamOptions.maxToolCalls),
        signal: controller.signal, // 超时控制
      });

      // 使用 Vercel AI SDK v5 的流式 API
      const textPromise = result.text;
      const toolCallsPromise = result.toolCalls;

      // 检查是否有工具调用
      const toolCalls = await toolCallsPromise;
      if (toolCalls && toolCalls.length > 0) {
        const usage = await result.totalUsage;

        return {
          content: null,
          tool_calls: toolCalls.map((tc: any) => ({
            id: tc.toolCallId,
            type: 'function',
            function: { name: tc.toolName, arguments: JSON.stringify(tc.args) }
          })),
          usage: {
            prompt_tokens: (usage as any)?.inputTokens || 0,
            completion_tokens: (usage as any)?.outputTokens || 0,
            reasoning_tokens: (usage as any)?.reasoningTokens || 0,
            cachedInput_tokens: (usage as any)?.cachedInputTokens || 0,
            total_tokens: (usage as any)?.totalTokens || 0
          },
        };
      }

      // 如果是文本流，创建流式结果
      let finalUsageResolver: (usage: TokenUsage | undefined) => void;
      const finalUsagePromise = new Promise<TokenUsage | undefined>(resolve => {
        finalUsageResolver = resolve;
        result.totalUsage.then(usage => resolve({
          prompt_tokens: (usage as any)?.inputTokens || 0,
          completion_tokens: (usage as any)?.outputTokens || 0,
          reasoning_tokens: (usage as any)?.reasoningTokens || 0,
          cachedInput_tokens: (usage as any)?.cachedInputTokens || 0,
          total_tokens: (usage as any)?.totalTokens || 0,
        })).catch(() => resolve(undefined));
      });

      const readableStream = new ReadableStream<string>({
        async start(controller) {
          try {
            // 使用 Vercel AI SDK v5 的 text 流 - text 是 Promise<string>
            const text = await textPromise;
            if (text) {
              console.log('大模型流式回复:', text);
              controller.enqueue(text);
            }
            controller.close();
          } catch (error) {
            controller.error(error);
          }
        }
      });

      return {
        stream: readableStream,
        finalUsagePromise: finalUsagePromise,
        finalDurationPromise: Promise.resolve(undefined), // Vercel SDK 不提供
      };
    } catch(error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }
}