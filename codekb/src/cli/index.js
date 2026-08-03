/**
 * CodeKB CLI 命令分发
 * 用法: codekb <command> [options]
 */
import fs from 'node:fs';
import path from 'node:path';
import { findCodekbDir } from '../config/index.js';
import { CodeKBService } from '../service.js';
import { KnowledgeStore } from '../knowledge/store.js';
import { runMcp } from '../mcp/server.js';

const USAGE = `CodeKB — 源码语义知识库

用法: codekb <command> [options]

命令:
  init [--skip-extract]          初始化项目（索引 + 可选知识提取）
  sync [--incremental|--reindex] 同步索引
  extract [--scope <path>] [--extractors <list>] [--from-change <name>] [--force]
                                 触发知识提取
  list [--type <type>] [--tags <tags>] [--status <status>] [--include-superseded] [--include-drafts]
                                 浏览知识条目
  review <id> <confirm|reject|edit> 审阅知识条目
  status                          索引健康状态
  mcp                             启动 MCP Server
  help                           显示帮助
`;

function parseArgs(args) {
  const flags = { _: [] };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
        flags[key] = args[++i];
      } else {
        flags[key] = true;
      }
    } else if (a.startsWith('-')) {
      const key = a.slice(1);
      flags[key] = i + 1 < args.length && !args[i + 1].startsWith('-') ? args[++i] : true;
    } else {
      flags._.push(a);
    }
  }
  return flags;
}

function findProjectDir() {
  const codekbDir = findCodekbDir();
  if (!codekbDir) {
    // 未找到已初始化的 codekb 目录，使用当前目录（init 时允许）
    return process.cwd();
  }
  return path.dirname(codekbDir);
}

export async function runCli(argv) {
  const [command, ...rest] = argv;
  if (!command || command === 'help' || command === '--help' || command === '-h') {
    console.log(USAGE);
    return;
  }
  const args = parseArgs(rest);
  const projectDir = findProjectDir();
  const service = new CodeKBService(projectDir);

  switch (command) {
    case 'init': {
      console.log('⏳ 正在初始化 CodeKB...');
      const result = await service.init({ skipExtract: Boolean(args['skip-extract']) });
      console.log(`\n✓ 初始化完成`);
      console.log(`  索引文件: ${result.files} | 代码行: ${result.lines} | 分块: ${result.chunks}`);
      if (result.knowledge) {
        console.log(`  知识条目: ${result.knowledge.created?.length || 0} 条`);
        if (result.knowledge.lowConfidence?.length) {
          console.log(`  ⚠ 待审阅 (confidence < 0.7): ${result.knowledge.lowConfidence.length} 条`);
        }
      }
      console.log(`  CodeGraph: ${result.codegraphReady ? '✓ 已就绪' : '✗ 未初始化 (结构化检索将降级)'}`);
      console.log(`\n→ 请将以下 MCP 配置添加到你的 AI 编码工具:`);
      console.log(JSON.stringify(result.mcpConfig, null, 2));
      break;
    }
    case 'sync': {
      const result = await service.sync({ incremental: !args.reindex, reindex: Boolean(args.reindex) });
      if (result.upToDate) console.log('✓ 索引已是最新');
      else console.log(`✓ 同步完成: ${result.filesIndexed || result.synced} 文件, ${result.chunks || 0} 分块, ${result.staleMarked?.length || 0} 条知识标记为过期`);
      break;
    }
    case 'extract': {
      const extractors = args.extractors ? args.extractors.split(',') : undefined;
      const result = args['from-change']
        ? await service.extractFromChange(args['from-change'])
        : await service.extract({ scope: args.scope, extractors, force: Boolean(args.force) });
      const created = result.created || [];
      console.log(`\n✓ 提取完成: 新增 ${created.length} 条`);
      if (result.byType) {
        for (const [type, count] of Object.entries(result.byType)) {
          if (count > 0) console.log(`  ${type}: ${count} 条`);
        }
      }
      if (result.lowConfidence?.length) {
        console.log(`\n⚠ 待审阅 (confidence < 0.7): ${result.lowConfidence.length} 条`);
        for (const e of result.lowConfidence.slice(0, 10)) {
          console.log(`  - ${e.id}: ${e.title} (${e.confidence?.toFixed?.(2) ?? '?'})`);
        }
      }
      break;
    }
    case 'list': {
      const store = new KnowledgeStore(projectDir);
      const tags = args.tags ? args.tags.split(',') : undefined;
      const entries = store.list({
        type: args.type, tags,
        status: args.status,
        includeSuperseded: Boolean(args['include-superseded']),
        includeDrafts: Boolean(args['include-drafts']),
      });
      if (!entries.length) {
        console.log('(无知识条目)');
        return;
      }
      for (const e of entries) {
        const statusMark = e.status === 'accepted' ? '✓' : e.status === 'superseded' ? '↺' : '•';
        console.log(`${statusMark} [${e.type}] ${e.id} — ${e.title} (${e.status}, conf: ${e.confidence})`);
      }
      console.log(`\n共 ${entries.length} 条`);
      break;
    }
    case 'review': {
      const id = args._[0];
      const verdict = args._[1];
      if (!id || !verdict || !['confirm', 'reject', 'edit'].includes(verdict)) {
        throw new Error('用法: codekb review <id> <confirm|reject|edit>');
      }
      const store = new KnowledgeStore(projectDir);
      const editText = verdict === 'edit' ? args._[2] : undefined;
      const result = store.review(id, verdict, editText);
      console.log(`✓ ${id} → ${verdict} 完成 (${result.filePath})`);
      break;
    }
    case 'status': {
      const s = service.status();
      console.log(`索引健康: ${s.index_health === 'healthy' ? '✓' : '✗'}`);
      console.log(`  分块数: ${s.indexed_chunks}`);
      console.log(`  BM25 文档: ${s.indexed_docs}`);
      console.log(`  知识条目: ${s.knowledge_entries}`);
      console.log(`  过期条目: ${s.stale_entries}`);
      console.log(`  CodeGraph: ${s.codegraph}`);
      console.log(`  上次同步: ${s.last_sync}`);
      break;
    }
    case 'mcp':
      await runMcp();
      return;
    default:
      throw new Error(`未知命令: ${command}\n\n${USAGE}`);
  }
}
