import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function readJsonc(file: string): Record<string, unknown> {
  const text = readFileSync(path.join(root, file), "utf8").replace(/^\s*\/\/.*$/gm, "");
  return JSON.parse(text) as Record<string, unknown>;
}

describe("設定ファイル", () => {
  it("wrangler.jsonc の既定 APP_ENV は production（素の deploy で Secure Cookie が外れない）", () => {
    const config = readJsonc("wrangler.jsonc");
    expect(config["vars"]).toEqual({ APP_ENV: "production" });
    const env = config["env"] as Record<string, { vars: Record<string, string> }>;
    expect(env["production"]?.vars).toEqual({ APP_ENV: "production" });
  });

  it("npm run dev は development を明示して渡す", () => {
    const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts["dev"]).toContain("--var APP_ENV:development");
  });

  it("CSP と SRI が配信設定に入っている", () => {
    const headers = readFileSync(path.join(root, "public", "_headers"), "utf8");
    expect(headers).toContain("Content-Security-Policy:");
    expect(headers).not.toMatch(/script-src[^;]*unsafe-inline/);
    const html = readFileSync(path.join(root, "public", "index.html"), "utf8");
    expect(html).toMatch(/font-awesome[^"]*"\s*\n?\s*integrity="sha384-/);
    expect(html).not.toMatch(/<script>(?!\s*<\/script>)/);
  });
});
