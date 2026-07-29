import { handleApiRequest } from "./router";
import { RoomDurableObject } from "./roomDurableObject";
import type { Env } from "./types";

export { RoomDurableObject };

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    return handleApiRequest(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;
