// 文字数は Python の str スライス（コードポイント単位）と揃える。JS の slice（UTF-16 単位）だと絵文字などで食い違う。
// Array.from で全文を配列化すると 10MB のテキストで一時的に大量のメモリを使うため、上限に達した時点で止める。
export function firstCodePoints(text: string, maxChars: number): string {
  let result = "";
  let count = 0;
  for (const char of text) {
    if (count >= maxChars) {
      break;
    }
    result += char;
    count += 1;
  }
  return result;
}

// Python の pathlib.Path（POSIX）と同じ規則で stem と suffix を分ける。
// 先頭のドットだけの名前（".pdf"）と末尾が "." で終わる名前は suffix を持たない。
export function splitFilename(filename: string): { stem: string; suffix: string } {
  const basename = filename.slice(filename.lastIndexOf("/") + 1);
  const dot = basename.lastIndexOf(".");
  if (dot <= 0 || dot === basename.length - 1) {
    return { stem: basename, suffix: "" };
  }
  return { stem: basename.slice(0, dot), suffix: basename.slice(dot) };
}

// 旧版 re.sub(r"[^\w\-]", "_", stem) と同じ。\w は Unicode の文字・数字・アンダースコアを含む。
export function sanitizeStem(stem: string): string {
  return stem.replace(/[^\p{L}\p{N}_-]/gu, "_");
}
