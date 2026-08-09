import { MCP_RESOURCE } from "./constants";
import { jsonResponse, readBoundedForm } from "./security";

const MAX_TOKEN_FORM_BYTES = 16 * 1024;

export async function validateExplicitTokenResource(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  if (request.method !== "POST" || url.pathname !== "/oauth/token") return null;

  const form = await readBoundedForm(request.clone(), MAX_TOKEN_FORM_BYTES);
  const grantType = String(form.get("grant_type") || "");
  if (!grantType) {
    // The provider also serves RFC 7009 revocation on this path. Revocation is not
    // token issuance, so it does not need an RFC 8707 resource parameter.
    return null;
  }

  const resources = form.getAll("resource");
  if (resources.length !== 1 || resources[0] !== MCP_RESOURCE) {
    return oauthError(
      "invalid_target",
      `Token requests must contain exactly one resource=${MCP_RESOURCE}.`
    );
  }

  const requestedScope = String(form.get("scope") || "").trim();
  if (requestedScope && !requestedScope.split(/\s+/).includes("content:read")) {
    return oauthError(
      "invalid_scope",
      "The protected resource baseline scope content:read must be retained."
    );
  }
  return null;
}

function oauthError(error: string, description: string): Response {
  return jsonResponse({ error, error_description: description }, 400);
}
