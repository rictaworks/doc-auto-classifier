import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";

// テスト専用の D1 互換アダプタ。Workers 実行環境を使わず、同じ SQLite 方言を node:sqlite で実行する。
// 対象は本体コードが使う prepare().bind().first()/all()/run() と batch() のみ。

const here = path.dirname(fileURLToPath(import.meta.url));
export const MIGRATION_PATH = path.join(here, "..", "..", "..", "migrations", "0001_init.sql");

type Bindable = string | number | null;

interface RunMeta {
  success: boolean;
  meta: { changes: number };
  results: unknown[];
}

class StatementFake {
  private values: Bindable[] = [];

  constructor(
    private readonly sqlite: DatabaseSync,
    readonly sql: string
  ) {}

  bind(...values: Bindable[]): StatementFake {
    this.values = values;
    return this;
  }

  async first<T>(): Promise<T | null> {
    const row = this.sqlite.prepare(this.sql).get(...(this.values as SQLInputValue[]));
    return (row ?? null) as T | null;
  }

  async all<T>(): Promise<{ results: T[] }> {
    const rows = this.sqlite.prepare(this.sql).all(...(this.values as SQLInputValue[]));
    return { results: rows as T[] };
  }

  async run(): Promise<RunMeta> {
    const info = this.sqlite.prepare(this.sql).run(...(this.values as SQLInputValue[]));
    return { success: true, meta: { changes: Number(info.changes) }, results: [] };
  }
}

export interface D1Fake {
  prepare(sql: string): StatementFake;
  batch(statements: StatementFake[]): Promise<RunMeta[]>;
  sqlite: DatabaseSync;
}

export function createD1Fake(): D1Fake {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON");
  sqlite.exec(readFileSync(MIGRATION_PATH, "utf8"));

  return {
    sqlite,
    prepare(sql: string) {
      return new StatementFake(sqlite, sql);
    },
    async batch(statements: StatementFake[]) {
      sqlite.exec("BEGIN");
      try {
        const results: RunMeta[] = [];
        for (const statement of statements) {
          results.push(await statement.run());
        }
        sqlite.exec("COMMIT");
        return results;
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    }
  };
}
