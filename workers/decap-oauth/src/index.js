const PROVIDER = "github";
const STATE_COOKIE = "decap_oauth_state";

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

function authHtml(message, status = 200) {
  const payload = JSON.stringify(message);

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
        var origin = window.location.origin;
        var message = ${payload};

        function sendResult() {
          if (window.opener) {
            window.opener.postMessage(message, origin);
          }
          window.close();
        }

        if (window.opener) {
          window.addEventListener("message", function(event) {
            if (event.origin === origin && event.data === "authorizing:" + provider) {
              sendResult();
            }
          });
          window.opener.postMessage("authorizing:" + provider, origin);
          window.setTimeout(sendResult, 1000);
        }
      })();
    </script>
    <p>Authentication complete. You can close this window.</p>
  </body>
</html>`, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Set-Cookie": `${STATE_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,
    },
  });
}

function oauthError(message, status = 400) {
  return authHtml(jsonMessage("error", { message }), status);
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
  const scope = requestUrl.searchParams.get("scope") || env.GITHUB_OAUTH_SCOPE || "public_repo";
  const authUrl = new URL("https://github.com/login/oauth/authorize");

  authUrl.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
  authUrl.searchParams.set("redirect_uri", callbackUrl.toString());
  authUrl.searchParams.set("scope", scope);
  authUrl.searchParams.set("state", state);

  return new Response(null, {
    status: 302,
    headers: {
      Location: authUrl.toString(),
      "Set-Cookie": `${STATE_COOKIE}=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
    },
  });
}

async function handleCallback(request, env) {
  if (!requireGithubClientId(env)) {
    return oauthError("Missing GITHUB_CLIENT_ID", 500);
  }

  if (!env.GITHUB_CLIENT_SECRET) {
    return oauthError("Missing GITHUB_CLIENT_SECRET", 500);
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const savedState = getCookie(request, STATE_COOKIE);

  if (!code) {
    return oauthError("Missing code");
  }

  if (!state || !savedState || state !== savedState) {
    return oauthError("Invalid state");
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
    return oauthError(detail, 502);
  }

  return authHtml(jsonMessage("success", {
    token: token.access_token,
    ...token,
  }));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/auth") {
      return redirectToGithub(request, env);
    }

    if (request.method === "GET" && url.pathname === "/callback") {
      return handleCallback(request, env);
    }

    if (request.method === "GET" && url.pathname === "/health") {
      return new Response("ok", { headers: { "Content-Type": "text/plain; charset=utf-8" } });
    }

    return new Response("Not found", { status: 404 });
  },
};
