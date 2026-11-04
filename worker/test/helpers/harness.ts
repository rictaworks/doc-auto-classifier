import type { Hono } from "hono";
import type { Env } from "../../src/env";
import { createApp } from "../../src/app";
import type { AppBindings } from "../../src/types";
import { createD1Fake, type D1Fake } from "./d1";
import { createMemoryBucket, type MemoryBucket } from "./r2";

export interface Harness {
  app: Hono<AppBindings>;
  env: Env;
  d1: D1Fake;
  bucket: MemoryBucket;
}

export function createHarness(appEnv: string = "test", overrides: Partial<Env> = {}): Harness {
  const d1 = createD1Fake();
  const bucket = createMemoryBucket();
  const env = {
    DB: d1,
    FILES: bucket,
    APP_ENV: appEnv,
    ...overrides
  } as unknown as Env;
  return { app: createApp(), env, d1, bucket };
}

export async function send(
  harness: Harness,
  path: string,
  init: { method?: string; body?: BodyInit; json?: unknown; cookie?: string } = {}
): Promise<Response> {
  const headers = new Headers();
  let body: BodyInit | undefined = init.body;
  if (init.json !== undefined) {
    headers.set("content-type", "application/json");
    body = JSON.stringify(init.json);
  }
  if (init.cookie !== undefined) {
    headers.set("cookie", `doc_sid=${init.cookie}`);
  }
  return harness.app.request(path, { method: init.method ?? "GET", headers, body }, harness.env);
}

export async function readJson(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

export function sessionIdFrom(response: Response): string {
  const setCookie = response.headers.get("set-cookie") ?? "";
  const match = /doc_sid=([^;]+)/.exec(setCookie);
  if (match === null || match[1] === undefined) {
    throw new Error(`doc_sid Cookie が応答に無い: ${setCookie}`);
  }
  return match[1];
}

export function uploadBody(name: string, content: ArrayBuffer | ArrayBufferView | string, type = "text/plain", hpField = ""): FormData {
  const form = new FormData();
  form.append("file", new File([content], name, { type }));
  form.append("hp_field", hpField);
  return form;
}
