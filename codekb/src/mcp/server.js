/**
 * CodeKB MCP Server
 *
 * 暴露工具:
 * - codekb_search      混合检索
 * - codekb_ask         RAG 问答
 * - codekb_explain     符号解释
 * - codekb_conventions 编码约定
 * - codekb_knowledge   知识条目浏览
 * - codekb_extract     触发知识提取
 * - codekb_review      知识条目审阅
 *
 * 依赖 @modelcontextprotocol/sdk（可选）。SDK 不可用时输出 JSON-RPC 2.0
 * 兼容的 stdio 协议，确保 MCP 兼容工具仍可对接。
 */
import { CodeKBService } from '../service.js';
import { KnowledgeStore } from '../knowledge/store.js';

const projectDir = process.env.CODEKB_PROJECT || process.cwd();

let McpServer = null;
let StdioServerTransport = null;
try {
  const mcp = await import('@modelcontextprotocol/sdk/server/mcp.js');
  const stdio = await import('@modelcontextprotocol/sdk/server/stdio.js');
  McpServer = mcp.McpServer;
  StdioServerTransport = stdio.StdioServerTransport;
} catch {
  McpServer = null;
}

/**
 * 工具处理器注册
 */
function registerHandlers(service, server) {
  const handlers = {
    codekb_search: async (params) => {
      const { query, scope, knowledge_types, max_results } = params.arguments || {};
      const result = await service.search(query || '', { scope, topK: max_results || 10 });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
    codekb_ask: async (params) => {
      const { question, context_symbols, include_sources } = params.arguments || {};
      const result = await service.ask(question || '', { scope: context_symbols });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
    codekb_explain: async (params) => {
      const { symbol } = params.arguments || {};
      const result = await service.explain(symbol || '');
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
    codekb_conventions: async (params) => {
      const { domain } = params.arguments || {};
      const store = new KnowledgeStore(projectDir);
      const conventions = store.list({ type: 'convention' })
        .filter((e) => !domain || (e.scope || '').includes(domain));
      return { content: [{ type: 'text', text: JSON.stringify(conventions.map((c) => ({
        title: c.title, description: c.body, scope: c.scope || 'global', source: c.source, example: c.example,
      })), null, 2) }] };
    },
    codekb_knowledge: async (params) => {
      const { type, tags, related_symbol, status, include_superseded, include_drafts } = params.arguments || {};
      const store = new KnowledgeStore(projectDir);
      const entries = store.list({
        type, tags, relatedSymbol: related_symbol, status,
        includeSuperseded: include_superseded, includeDrafts: include_drafts,
      });
      return { content: [{ type: 'text', text: JSON.stringify(entries.map((e) => ({
        id: e.id, type: e.type, title: e.title, status: e.status, confidence: e.confidence,
        related_symbols: e.related_symbols, tags: e.tags, source: e.source,
      })), null, 2) }] };
    },
    codekb_extract: async (params) => {
      const { scope, extractors, force, from_change, stale_only } = params.arguments || {};
      const result = from_change
        ? await service.extractFromChange(from_change)
        : await service.extract({ scope, extractors, force, staleOnly: stale_only });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
    codekb_review: async (params) => {
      const { id, verdict, edit } = params.arguments || {};
      const store = new KnowledgeStore(projectDir);
      const result = store.review(id, verdict, edit);
      return { content: [{ type: 'text', text: JSON.stringify({ ok: true, entry: result }, null, 2) }] };
    },
  };
  return handlers;
}

/**
 * 使用 MCP SDK 启动
 */
async function startWithSdk(service) {
  const server = new McpServer('codekb', { version: '0.1.0' });
  const handlers = registerHandlers(service, server);
  for (const [name, fn] of Object.entries(handlers)) {
    server.registerTool(name, { description: toolDescriptions[name] }, fn);
  }
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

/**
 * 降级：JSON-RPC 2.0 stdio 协议（SDK 不可用）
 */
async function startFallback(service) {
  const handlers = registerHandlers(service, null);
  const stdin = process.stdin;
  const stdout = process.stdout;
  let buffer = '';
  stdin.setEncoding('utf8');
  stdin.on('data', async (chunk) => {
    buffer += chunk;
    let idx;
    while ((idx = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 1);
      if (!line.trim()) continue;
      try {
        const msg = JSON.parse(line);
        if (msg.method === 'initialize') {
          const res = { jsonrpc: '2.0', id: msg.id, result: {
            protocolVersion: '2024-11-05',
            capabilities: { tools: { listChanged: false } },
            serverInfo: { name: 'codekb', version: '0.1.0' },
          } };
          stdout.write(JSON.stringify(res) + '\n');
        } else if (msg.method === 'tools/list') {
          const tools = Object.keys(handlers).map((name) => ({ name, description: toolDescriptions[name], inputSchema: toolSchemas[name] }));
          stdout.write(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: { tools } }) + '\n');
        } else if (msg.method === 'tools/call') {
          const { name, arguments: args } = msg.params;
          const handler = handlers[name];
          if (handler) {
            const result = await handler({ arguments: args });
            stdout.write(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result }) + '\n');
          } else {
            stdout.write(JSON.stringify({ jsonrpc: '2.0', id: msg.id, error: { code: -32601, message: `Unknown tool: ${name}` } }) + '\n');
          }
        } else if (msg.method === 'notifications/initialized') {
          // no-op
        } else if (msg.id !== undefined) {
          stdout.write(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: {} }) + '\n');
        }
      } catch (e) {
        // 忽略无法解析的行
      }
    }
  });
}

const toolDescriptions = {
  codekb_search: '混合检索项目代码与知识：结构化 + 向量语义 + BM25 词法',
  codekb_ask: '基于项目代码的 RAG 自然语言问答',
  codekb_explain: '解释符号：功能摘要 + 关联知识 + 缺陷模式 + 调用关系 + 编码约定',
  codekb_conventions: '获取项目或特定领域的编码约定',
  codekb_knowledge: '浏览知识条目（按类型/标签/状态过滤）',
  codekb_extract: '触发知识提取（支持从 OpenSpec 变更提取）',
  codekb_review: '审阅知识条目: confirm | reject | edit',
};

const toolSchemas = {
  codekb_search: { type: 'object', properties: { query: { type: 'string' }, scope: { type: 'array', items: { type: 'string' } }, knowledge_types: { type: 'array', items: { type: 'string' } }, max_results: { type: 'number' } }, required: ['query'] },
  codekb_ask: { type: 'object', properties: { question: { type: 'string' }, context_symbols: { type: 'array', items: { type: 'string' } }, include_sources: { type: 'boolean' } }, required: ['question'] },
  codekb_explain: { type: 'object', properties: { symbol: { type: 'string' } }, required: ['symbol'] },
  codekb_conventions: { type: 'object', properties: { domain: { type: 'string' } } },
  codekb_knowledge: { type: 'object', properties: { type: { type: 'string' }, tags: { type: 'array', items: { type: 'string' } }, related_symbol: { type: 'string' }, status: { type: 'string' }, include_superseded: { type: 'boolean' }, include_drafts: { type: 'boolean' } } },
  codekb_extract: { type: 'object', properties: { scope: { type: 'string' }, extractors: { type: 'array', items: { type: 'string' } }, force: { type: 'boolean' }, from_change: { type: 'string' }, stale_only: { type: 'boolean' } } },
  codekb_review: { type: 'object', properties: { id: { type: 'string' }, verdict: { type: 'string', enum: ['confirm', 'reject', 'edit'] }, edit: { type: 'string' } }, required: ['id', 'verdict'] },
};

/**
 * 启动 MCP Server
 */
export async function runMcp() {
  const service = new CodeKBService(projectDir);
  if (McpServer) {
    await startWithSdk(service);
  } else {
    await startFallback(service);
  }
}
