/**
 * 查询路由器 — 判断查询类型，决定各检索通道的权重
 *
 * 路由规则（对应方案 F2.4）:
 * - 精确符号名查询（CamelCase/点号路径）→ 优先结构化检索
 * - 自然语言描述 → 优先向量语义检索
 * - 包含错误信息/字符串字面量 → 优先 BM25
 * - 包含 bug/fix/error/异常 等关键词 → bug-pattern 权重提升
 */
import { rrfFusion, weightedFusion } from './fusion.js';

const BUG_KEYWORDS = ['bug', 'fix', 'error', '异常', '崩溃', '丢失', '死循环', '故障', '缺陷'];

/**
 * 识别精确符号名查询
 * 匹配: PaymentService.processRefund / processRefund / SessionCache
 */
function isSymbolQuery(query) {
  return /^[A-Z][A-Za-z0-9_.]*(?:\.[A-Za-z0-9_]+)*$/.test(query.trim())
    || /^[a-z][a-zA-Z0-9_]*\.[A-Z][A-Za-z0-9_]*$/.test(query.trim());
}

/**
 * 识别错误信息查询（包含异常类名或错误码）
 */
function isErrorQuery(query) {
  return /(exception|error|nullpointer|illegalstate|timeout|failed|失败|错误)/i.test(query);
}

/**
 * 判断是否为 bugfix 查询
 */
export function isBugfixQuery(query) {
  return BUG_KEYWORDS.some((kw) => query.toLowerCase().includes(kw.toLowerCase()));
}

/**
 * 路由决策
 */
export function routeQuery(query) {
  const q = query.trim();
  if (isSymbolQuery(q)) {
    return {
      type: 'symbol',
      weights: { structural: 0.7, semantic: 0.1, lexical: 0.2 },
      boost: {},
    };
  }
  if (isErrorQuery(q)) {
    return {
      type: 'error',
      weights: { structural: 0.1, semantic: 0.3, lexical: 0.6 },
      boost: {},
    };
  }
  const isBug = isBugfixQuery(q);
  return {
    type: isBug ? 'bugfix' : 'nl',
    weights: { structural: 0.3, semantic: 0.5, lexical: 0.2 },
    boost: isBug ? { 'bug-pattern': 2.0, 'design-decision': 1.5, convention: 1.2 } : {},
  };
}

/**
 * 执行混合检索
 * @param {Object} channels - { structural, semantic, lexical } 三通道搜索函数
 * @param {string} query - 查询文本
 */
export async function hybridSearch(channels, query, options = {}) {
  const route = routeQuery(query);
  const topK = options.topK || 10;

  const [structural, semantic, lexical] = await Promise.all([
    channels.structural ? channels.structural(query, { topK }) : Promise.resolve([]),
    channels.semantic ? channels.semantic(query, { topK }) : Promise.resolve([]),
    channels.lexical ? channels.lexical(query, { topK }) : Promise.resolve([]),
  ]);

  const results = weightedFusion(
    [structural, semantic, lexical],
    [route.weights.structural, route.weights.semantic, route.weights.lexical],
    topK,
  );

  return {
    route: route.type,
    results: results.map((r) => ({
      ...r,
      channel: r.channels || [],
      match: r.channels,
    })),
  };
}
