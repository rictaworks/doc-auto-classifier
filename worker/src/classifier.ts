import { CLASSIFIER_RULES } from "./config/classifierRules";
import { CLASSIFIER_CONTENT_MAX_CHARS, DEFAULT_CATEGORY_NAME } from "./config/constants";
import { firstCodePoints } from "./text";

// 旧 FastAPI 版 app/classifier.py の移植。キーワードの部分一致スコアで分類する。
export function classify(filename: string, content: string): string {
  const normalizedFilename = normalize(filename);
  const normalizedContent = normalize(firstCodePoints(content, CLASSIFIER_CONTENT_MAX_CHARS));

  let bestCategory = DEFAULT_CATEGORY_NAME;
  let bestScore = 0;

  for (const rule of CLASSIFIER_RULES) {
    const score = scoreText(normalizedFilename, rule.keywords) + scoreText(normalizedContent, rule.keywords);
    if (score > bestScore) {
      bestScore = score;
      bestCategory = rule.category;
    }
  }

  return bestCategory;
}

export function scoreText(text: string, keywords: readonly string[]): number {
  return keywords.filter((keyword) => text.includes(keyword)).length;
}

export function normalize(text: string): string {
  return text.toLowerCase();
}
