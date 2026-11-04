import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["worker/test/**/*.test.ts"],
    // 成功したテストのログ（JSON 1 行）は出さず、失敗時だけ表示する
    silent: "passed-only"
  }
});
