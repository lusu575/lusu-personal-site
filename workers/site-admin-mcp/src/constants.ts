import { MCP_OWNER_RESOURCE } from "../../../functions/api/mcp-oauth-ledger.mjs";

export const SERVER_NAME = "lusu-site-mcp";
export const SERVER_VERSION = "0.2.0";
export const CANONICAL_ISSUER = "https://lusu575.com";
export const MCP_RESOURCE = MCP_OWNER_RESOURCE;
export const MCP_PATH = "/mcp";
export const AUTHORIZE_PATH = "/oauth/authorize";
export const TOKEN_PATH = "/oauth/token";
export const REGISTER_PATH = "/oauth/register";

export const OWNER_SCOPES = Object.freeze([
  "content:read",
  "content:write",
  "content:delete"
] as const);

export type OwnerScope = (typeof OWNER_SCOPES)[number];

export const SCOPE_DESCRIPTIONS: Readonly<Record<OwnerScope, Readonly<{
  zh: string;
  en: string;
  ja: string;
}>>> = Object.freeze({
  "content:read": Object.freeze({
    zh: "读取网站已发布文章与公开内容",
    en: "Read published site articles and public content",
    ja: "公開済みの記事と公開コンテンツを読み取る"
  }),
  "content:write": Object.freeze({
    zh: "查看草稿并原子发布或更新知识库文章",
    en: "View drafts and atomically publish or update knowledge articles",
    ja: "下書きの表示、知識記事のアトミック公開または更新"
  }),
  "content:delete": Object.freeze({
    zh: "永久删除经确认且版本匹配的普通文章",
    en: "Permanently delete a confirmed ordinary article whose version matches",
    ja: "確認済みでバージョンが一致する通常の記事を完全に削除する"
  })
});

export const CONSENT_FLOW_TTL_SECONDS = 10 * 60;
export const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;
export const ACCESS_TOKEN_TTL_SECONDS = 60 * 60;
export const CLIENT_REGISTRATION_TTL_SECONDS = 90 * 24 * 60 * 60;
export const CLIENT_REGISTRATION_RATE_LIMIT = 12;
export const CLIENT_REGISTRATION_RATE_WINDOW_SECONDS = 60 * 60;
