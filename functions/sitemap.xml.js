import { onRequest as apiRequest } from "./api/[[route]].js";

export function onRequest(context) {
  const url = new URL(context.request.url);
  url.pathname = "/api/sitemap.xml";
  return apiRequest({
    ...context,
    request: new Request(url.toString(), context.request)
  });
}
