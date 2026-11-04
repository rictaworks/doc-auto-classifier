import { createApp } from "./app";
import type { Env } from "./env";
import { runDailyReset } from "./reset";

const app = createApp();

export default {
  fetch: app.fetch,

  async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
    await runDailyReset(env);
  }
} satisfies ExportedHandler<Env>;
