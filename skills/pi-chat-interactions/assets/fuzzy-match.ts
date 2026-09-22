/**
 * 触发面板模糊打分（纯函数参考实现，可直接拷入目标项目）。
 *
 * 同一套打分器服务两个面板：
 * - `/` 命令面板：value = 命令名，label = 展示名，keywords 可选
 * - `@` 文件面板：value = name（文件名），keywords 里放 relativePath / 全路径
 *
 * 归一化约定：所有输入先 trim + toLowerCase；空 query 得 0 分（全部通过）。
 *
 * 来源：按上游 Apache-2.0 参考实现提炼（见 licenses/ATTRIBUTION.txt）。
 */

/**
 * 单文本模糊分：
 * - 前缀命中：len(text) - len(query)（越短越好）
 * - 连续子串：100 + 首次下标（越靠前越好）
 * - 子序列兜底：200 + 间隙惩罚 + 尾部惩罚
 * - 无命中：null
 */
export function scoreFuzzyMatch(text: string, query: string): number | null {
  const normalizedText = text.trim().toLowerCase();
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedText) return null;
  if (!normalizedQuery) return 0;

  if (normalizedText.startsWith(normalizedQuery)) {
    return normalizedText.length - normalizedQuery.length;
  }

  const substringIndex = normalizedText.indexOf(normalizedQuery);
  if (substringIndex !== -1) {
    return 100 + substringIndex;
  }

  let score = 200;
  let searchStart = 0;
  for (const char of normalizedQuery) {
    const foundIndex = normalizedText.indexOf(char, searchStart);
    if (foundIndex === -1) return null;
    score += foundIndex - searchStart;
    searchStart = foundIndex + 1;
  }
  return score + (normalizedText.length - normalizedQuery.length);
}

export interface SuggestionCandidate {
  value: string;
  label?: string;
  description?: string;
  /** 附加匹配域（如 @ 文件的 relativePath / 全路径），每个域 +450 权重。 */
  keywords?: string[];
}

/**
 * 多域综合分：取各域最优。
 * 权重经验值：value 0 档、label +50、description +250、keywords +450。
 * value 是命令/文件名的精确面，必须严格压过描述的宽松命中。
 */
export function scoreSuggestion(
  suggestion: SuggestionCandidate,
  query: string,
): number | null {
  const valueScore = scoreFuzzyMatch(suggestion.value, query);
  const labelScore = suggestion.label
    ? scoreFuzzyMatch(suggestion.label, query)
    : null;
  const descriptionScore = suggestion.description
    ? scoreFuzzyMatch(suggestion.description, query)
    : null;
  const keywordScore = Math.min(
    ...(suggestion.keywords ?? []).map((keyword) => {
      const score = scoreFuzzyMatch(keyword, query);
      return score === null ? Number.POSITIVE_INFINITY : score + 450;
    }),
    Number.POSITIVE_INFINITY,
  );
  const bestScore = Math.min(
    valueScore ?? Number.POSITIVE_INFINITY,
    labelScore === null ? Number.POSITIVE_INFINITY : labelScore + 50,
    descriptionScore === null
      ? Number.POSITIVE_INFINITY
      : descriptionScore + 250,
    keywordScore,
  );
  return Number.isFinite(bestScore) ? bestScore : null;
}

/** CJK 判定：中文 query 退化为「前缀/连续子串」两级，禁用子序列兜底。 */
export function isHanQuery(query: string): boolean {
  return /\p{Script=Han}/u.test(query.trim());
}

/**
 * 文件候选专用打分：
 * - name 精确面：0 档
 * - relativePath：+25 档（目录段子串）
 * - relativePath / 全路径 keywords：+300 档（跨目录段子序列命中）
 * 中文 query 只走前缀/子串两级（子序列对 CJK 过宽）。
 */
export function scoreFileCandidate(input: {
  name: string;
  relativePath: string;
  fullPath?: string;
  query: string;
}): number | null {
  const normalizedQuery = input.query.trim().toLowerCase();
  if (!normalizedQuery) return 0;

  const hanOnly = isHanQuery(normalizedQuery);
  const nameScore = scoreFuzzyMatch(input.name, normalizedQuery);
  const relativePathScore = scoreFuzzyMatch(
    input.relativePath,
    normalizedQuery,
  );
  const keywordScore = Math.min(
    relativePathScore === null
      ? Number.POSITIVE_INFINITY
      : relativePathScore + 300,
    input.fullPath
      ? scoreFuzzyMatch(input.fullPath, normalizedQuery) === null
        ? Number.POSITIVE_INFINITY
        : (scoreFuzzyMatch(input.fullPath, normalizedQuery) as number) + 300
      : Number.POSITIVE_INFINITY,
  );
  const bestScore = Math.min(
    nameScore ?? Number.POSITIVE_INFINITY,
    relativePathScore === null
      ? Number.POSITIVE_INFINITY
      : relativePathScore + 25,
    keywordScore,
  );
  if (!Number.isFinite(bestScore)) return null;
  if (hanOnly && bestScore >= 200) return null; // 中文 query 不接受子序列兜底档
  return bestScore;
}

/**
 * Top-K 插入（O(n log K)，替代 findIndex 线性扫的 O(n×K)）。
 * compare 按 (score, index) 严格全序：同分先到先得，保证稳定性。
 */
export function insertTopK<T>(
  bestMatches: { item: T; score: number; index: number }[],
  item: T,
  score: number,
  index: number,
  limit: number,
  tiebreak?: (left: T, right: T) => number,
): void {
  const scored = { item, score, index };
  const compare = (left: typeof scored, right: typeof scored): number => {
    if (left.score !== right.score) return left.score - right.score;
    if (left.index !== right.index) return left.index - right.index;
    return tiebreak ? tiebreak(left.item, right.item) : 0;
  };
  const worst = bestMatches[bestMatches.length - 1];
  if (
    worst !== undefined &&
    bestMatches.length >= limit &&
    compare(scored, worst) >= 0
  ) {
    return;
  }
  let low = 0;
  let high = bestMatches.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (compare(scored, bestMatches[mid]) < 0) {
      high = mid;
    } else {
      low = mid + 1;
    }
  }
  if (low === bestMatches.length) {
    if (bestMatches.length < limit) bestMatches.push(scored);
    return;
  }
  bestMatches.splice(low, 0, scored);
  if (bestMatches.length > limit) bestMatches.pop();
}

/** 触发面板展示上限：大到不显残缺，小到打分与虚拟列表可承受。 */
export const SUGGESTION_DISPLAY_CAP = 1000;
