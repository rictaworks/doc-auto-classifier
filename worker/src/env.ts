import { MESSAGES } from "./config/messages";

export interface Env {
  DB: D1Database;
  FILES: R2Bucket;
  ASSETS: Fetcher;
  APP_ENV?: string;
}

export type AppEnvironment = "development" | "test" | "production";

const APP_ENVIRONMENTS: readonly AppEnvironment[] = ["development", "test", "production"];

// 未設定・未知の値は既定値に寄せず例外にする（フォールバック禁止）
export function parseAppEnvironment(raw: string | undefined): AppEnvironment {
  if (raw === undefined || !APP_ENVIRONMENTS.some((name) => name === raw)) {
    throw new Error(`${MESSAGES.appEnvInvalid}: raw=${raw ?? "(unset)"}`);
  }
  return raw as AppEnvironment;
}
