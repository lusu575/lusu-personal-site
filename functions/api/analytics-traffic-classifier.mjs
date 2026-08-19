const AUTOMATED_CLIENT_RULES = Object.freeze([
  {
    category: "search-crawler",
    pattern: /googlebot|googleother|applebot|bingbot|duckassistbot|baiduspider|yandexbot|360spider/i
  },
  {
    category: "ai-crawler",
    pattern: /gptbot|oai-searchbot|chatgpt-user|claudebot|claude-web|anthropic-ai|perplexitybot|bytespider|meta-externalagent|facebookexternalhit/i
  },
  {
    category: "seo-crawler",
    pattern: /ahrefsbot|semrushbot|mj12bot|dotbot|petalbot|dataforseobot/i
  },
  {
    category: "security-scanner",
    pattern: /censysinspect|palo alto networks|cortex-xpanse|cms-scanner|wp2shell|securityresearch|domainchecker|dataprovider\.com|nuclei|masscan|zgrab/i
  },
  {
    category: "synthetic-monitor",
    pattern: /lusu-production-smoke|uptimerobot|pingdom|statuscake/i
  },
  {
    category: "automation-tool",
    pattern: /headlesschrome|playwright|puppeteer|scrapy|python-requests|python-urllib|go-http-client|apache-httpclient|okhttp|curl\/|wget\/|\bundici\b/i
  },
  {
    category: "infrastructure-automation",
    pattern: /nginx-ssl early hints|bastion early hints/i
  },
  {
    category: "generic-crawler",
    pattern: /(?:^|[^a-z])(?:bot|crawler|spider)(?:[^a-z]|$)/i
  }
]);

export function classifyAnalyticsClient(userAgent) {
  const normalized = String(userAgent || "").trim().slice(0, 1000);
  if (!normalized) {
    return Object.freeze({ automated: false, category: "unknown" });
  }
  const matched = AUTOMATED_CLIENT_RULES.find((rule) => rule.pattern.test(normalized));
  return Object.freeze({
    automated: Boolean(matched),
    category: matched?.category || "browser"
  });
}

export function shouldSkipAnalyticsRequest(request) {
  return classifyAnalyticsClient(request?.headers?.get?.("User-Agent")).automated;
}
