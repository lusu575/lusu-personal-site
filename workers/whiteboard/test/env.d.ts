import type { WhiteboardEnv } from "../src/types";

declare global {
  namespace Cloudflare {
    interface Env extends WhiteboardEnv {
      WHITEBOARD_ROOMS: WhiteboardEnv["WHITEBOARD_ROOMS"];
    }
  }
}

export {};
