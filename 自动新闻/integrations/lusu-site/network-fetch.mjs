import {
  EnvHttpProxyAgent,
  fetch as undiciFetch
} from "undici";

function firstEnvironmentValue(environment, names) {
  for (const name of names) {
    const value = String(environment?.[name] || "").trim();
    if (value) {
      return value;
    }
  }
  return undefined;
}

export function proxyOptionsFromEnvironment(environment = process.env) {
  return {
    httpProxy: firstEnvironmentValue(environment, ["HTTP_PROXY", "http_proxy"]),
    httpsProxy: firstEnvironmentValue(environment, ["HTTPS_PROXY", "https_proxy"]),
    noProxy: firstEnvironmentValue(environment, ["NO_PROXY", "no_proxy"])
  };
}

export function createProxyAwareFetch({
  environment = process.env,
  fetchImpl = undiciFetch,
  dispatcherFactory = (options) => new EnvHttpProxyAgent(options)
} = {}) {
  const dispatcher = dispatcherFactory(proxyOptionsFromEnvironment(environment));
  let closed = false;

  return {
    fetch(input, init = {}) {
      if (closed) {
        throw new Error("网络客户端已经关闭。");
      }
      return fetchImpl(input, {
        ...init,
        dispatcher: init.dispatcher || dispatcher
      });
    },
    async close() {
      if (closed) {
        return;
      }
      closed = true;
      await dispatcher.close();
    }
  };
}
