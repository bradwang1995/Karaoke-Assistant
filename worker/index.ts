import { handleApiRequest } from "./router";
import { RoomDurableObject } from "./roomDurableObject";
import type { Env } from "./types";
import { runDataRetention } from "./dataRetention";

export { RoomDurableObject };

export default {
  async scheduled(controller, env) {
    await runDataRetention(env.DB, controller.scheduledTime);
  },
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    return handleApiRequest(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;
