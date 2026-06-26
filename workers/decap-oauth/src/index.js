const PROVIDER = "github";
const STATE_COOKIE = "decap_oauth_state";
const ORIGIN_COOKIE = "decap_oauth_origin";

function cookieHeader(name, value, maxAge) {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

function clearCookieHeader(name) {
  return cookieHeader(name, "", 0);
}

function randomState() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function getCookie(request, name) {
  const cookie = request.headers.get("Cookie") || "";
  const parts = cookie.split(";").map((part) => part.trim());
  const match = parts.find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : "";
}

function jsonMessage(type, body) {
  return `authorization:${PROVIDER}:${type}:${JSON.stringify(body)}`;
}

function normalizeOrigin(value) {
  if (!value) {
    return "";
  }

  const trimmed = value.trim();
  const candidate = /^https?:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    return new URL(candidate).origin;
  } catch {
    return "";
  }
}

function configuredOrigins(env) {
  return (env.CMS_ORIGINS || env.CMS_ORIGIN || "")
    .split(",")
    .map(normalizeOrigin)
    .filter((origin, index, origins) => origin && origins.indexOf(origin) === index);
}

function originError(message, status = 403) {
  return new Response(message, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function selectOpenerOrigin(requestUrl, env) {
  const allowedOrigins = configuredOrigins(env);

  if (allowedOrigins.length === 0) {
    return { error: originError("Missing CMS origin configuration", 500) };
  }

  const requestedOrigin = normalizeOrigin(requestUrl.searchParams.get("site_id"));

  if (requestedOrigin && !allowedOrigins.includes(requestedOrigin)) {
    return { error: originError("Unauthorized site_id") };
  }

  return { origin: requestedOrigin || allowedOrigins[0] };
}

function getCallbackOrigin(request, env) {
  const allowedOrigins = configuredOrigins(env);
  const storedOrigin = normalizeOrigin(getCookie(request, ORIGIN_COOKIE));

  if (storedOrigin && allowedOrigins.includes(storedOrigin)) {
    return storedOrigin;
  }

  return allowedOrigins[0] || "";
}

function selectScope(requestUrl, env) {
  const configuredScope = env.GITHUB_OAUTH_SCOPE || "public_repo";
  const requestedScope = requestUrl.searchParams.get("scope");

  if (requestedScope && requestedScope !== configuredScope) {
    return { error: originError("Unauthorized OAuth scope") };
  }

  return { scope: configuredScope };
}

function authHtml(message, openerOrigin, status = 200) {
  const payload = JSON.stringify(message);
  const expectedOrigin = JSON.stringify(openerOrigin);
  const headers = new Headers({ "Content-Type": "text/html; charset=utf-8" });

  headers.set("Cache-Control", "no-store");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.append("Set-Cookie", clearCookieHeader(STATE_COOKIE));
  headers.append("Set-Cookie", clearCookieHeader(ORIGIN_COOKIE));

  return new Response(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Decap CMS Authorization</title>
  </head>
  <body>
    <script>
      (function() {
        var provider = ${JSON.stringify(PROVIDER)};
        var openerOrigin = ${expectedOrigin};
        var message = ${payload};

        function sendResult(targetOrigin) {
          if (window.opener) {
            window.opener.postMessage(message, targetOrigin);
          }
          window.close();
        }

        if (window.opener) {
          window.addEventListener("message", function(event) {
            if (event.source === window.opener &&
                event.data === "authorizing:" + provider &&
                (!openerOrigin || event.origin === openerOrigin)) {
              sendResult(event.origin);
            }
          });
          window.opener.postMessage("authorizing:" + provider, openerOrigin || "*");
          if (openerOrigin) {
            window.setTimeout(function() {
              sendResult(openerOrigin);
            }, 1000);
          }
        }
      })();
    </script>
    <p>Authentication complete. You can close this window.</p>
  </body>
</html>`, {
    status,
    headers,
  });
}

function oauthError(message, openerOrigin = "", status = 400) {
  return authHtml(jsonMessage("error", { message }), openerOrigin, status);
}

function statusPage(request) {
  const body = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Decap CMS OAuth Proxy</title>
  </head>
  <body>
    <h1>Decap CMS OAuth proxy is running</h1>
    <p>This endpoint is used by Decap CMS for GitHub authorization.</p>
    <p><a href="https://arjenzhou.com/admin/">Open CMS admin</a></p>
  </body>
</html>`;

  return new Response(request.method === "HEAD" ? null : body, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function requireGithubClientId(env) {
  return Boolean(env.GITHUB_CLIENT_ID);
}

function redirectToGithub(request, env) {
  if (!requireGithubClientId(env)) {
    return new Response("Missing GITHUB_CLIENT_ID", { status: 500 });
  }

  const requestUrl = new URL(request.url);
  const callbackUrl = new URL("/callback", requestUrl.origin);
  const state = randomState();
  const openerOriginResult = selectOpenerOrigin(requestUrl, env);
  const scopeResult = selectScope(requestUrl, env);
  const authUrl = new URL("https://github.com/login/oauth/authorize");
  const headers = new Headers();

  if (openerOriginResult.error) {
    return openerOriginResult.error;
  }

  if (scopeResult.error) {
    return scopeResult.error;
  }

  authUrl.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
  authUrl.searchParams.set("redirect_uri", callbackUrl.toString());
  authUrl.searchParams.set("scope", scopeResult.scope);
  authUrl.searchParams.set("state", state);

  headers.set("Location", authUrl.toString());
  headers.set("Cache-Control", "no-store");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.append("Set-Cookie", cookieHeader(STATE_COOKIE, state, 600));
  headers.append("Set-Cookie", cookieHeader(ORIGIN_COOKIE, openerOriginResult.origin, 600));

  return new Response(null, {
    status: 302,
    headers,
  });
}

async function handleCallback(request, env) {
  const openerOrigin = getCallbackOrigin(request, env);

  if (!requireGithubClientId(env)) {
    return oauthError("Missing GITHUB_CLIENT_ID", openerOrigin, 500);
  }

  if (!env.GITHUB_CLIENT_SECRET) {
    return oauthError("Missing GITHUB_CLIENT_SECRET", openerOrigin, 500);
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const savedState = getCookie(request, STATE_COOKIE);

  if (!code) {
    return oauthError("Missing code", openerOrigin);
  }

  if (!state || !savedState || state !== savedState) {
    return oauthError("Invalid state", openerOrigin);
  }

  const callbackUrl = new URL("/callback", url.origin);
  const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": "arjenzhou-decap-oauth",
    },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: callbackUrl.toString(),
      state,
    }),
  });

  const token = await tokenResponse.json();

  if (!tokenResponse.ok || token.error || !token.access_token) {
    const detail = token.error_description || token.error || "GitHub token exchange failed";
    return oauthError(detail, openerOrigin, 502);
  }

  return authHtml(jsonMessage("success", {
    token: token.access_token,
    ...token,
  }), openerOrigin);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const isRead = request.method === "GET" || request.method === "HEAD";

    if (request.method === "GET" && url.pathname === "/auth") {
      return redirectToGithub(request, env);
    }

    if (request.method === "GET" && url.pathname === "/callback") {
      return handleCallback(request, env);
    }

    if (isRead && url.pathname === "/") {
      return statusPage(request);
    }

    if (isRead && url.pathname === "/health") {
      return new Response(request.method === "HEAD" ? null : "ok", {
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    return new Response("Not found", { status: 404 });
  },
};
