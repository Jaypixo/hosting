import { handleEdgeRequest, type EdgeEnv } from "../../../packages/cloudflare-worker/src/index.js";

export default {
  async fetch(request: Request, env: EdgeEnv): Promise<Response> {
    return handleEdgeRequest(request, env);
  }
};

