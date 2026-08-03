/**
 * RRF（Reciprocal Rank Fusion）融合排序
 * score(d) = Σ 1/(k + rank_i(d))
 */
const K = 60;

/**
 * 融合多个检索通道的排序结果
 * @param {Array<Array<{id:string, score?:number}>>} rankedLists 各通道结果列表
 * @returns 融合后的排序结果
 */
export function rrfFusion(rankedLists, topK = 10) {
  const scores = new Map();
  const details = new Map();
  rankedLists.forEach((list, channelIdx) => {
    const channelNames = ['structural', 'semantic', 'lexical'];
    const channel = channelNames[channelIdx] || `channel${channelIdx}`;
    list.forEach((item, rank) => {
      const key = item.file ? `${item.file}:${item.startLine ?? ''}` : item.id;
      if (!scores.has(key)) {
        scores.set(key, 0);
        details.set(key, { ...item, channels: [] });
      }
      scores.set(key, scores.get(key) + 1 / (K + rank + 1));
      const detail = details.get(key);
      if (detail.channels.indexOf(channel) === -1) detail.channels.push(channel);
      detail.rrf_score = scores.get(key);
    });
  });
  return [...details.entries()]
    .sort((a, b) => scores.get(b[0]) - scores.get(a[0]))
    .slice(0, topK)
    .map(([, item]) => item);
}

/**
 * 加权融合（替代 RRF，支持通道权重配置）
 */
export function weightedFusion(rankedLists, weights, topK = 10) {
  const scores = new Map();
  const details = new Map();
  rankedLists.forEach((list, channelIdx) => {
    const weight = weights[channelIdx] || 0.33;
    list.forEach((item, rank) => {
      const key = item.file ? `${item.file}:${item.startLine ?? ''}` : item.id;
      if (!scores.has(key)) {
        scores.set(key, 0);
        details.set(key, { ...item, channels: [] });
      }
      const rankScore = item.score || (1 / (rank + 1));
      scores.set(key, scores.get(key) + weight * rankScore);
      details.get(key).channels.push(channelIdx === 0 ? 'structural' : channelIdx === 1 ? 'semantic' : 'lexical');
      details.get(key).weighted_score = scores.get(key);
    });
  });
  return [...details.entries()]
    .sort((a, b) => scores.get(b[0]) - scores.get(a[0]))
    .slice(0, topK)
    .map(([, item]) => item);
}
