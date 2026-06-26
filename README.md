# arjenzhou.github.io

Hugo source lives on the `main` branch. GitHub Actions builds the site and
uploads the generated `public/` directory to Cloudflare Pages.

## Cloudflare Pages

Deployments are handled by `.github/workflows/deploy.yml`:

- Trigger: push to `main`, or manual `workflow_dispatch`
- Build command: `hugo --gc --minify`
- Publish directory: `public`
- Cloudflare Pages project: `arjenzhou`
- Production branch: `main`

GitHub Actions needs this repository secret:

- `CLOUDFLARE_API_TOKEN`, backed by a Cloudflare Account API Token with
  `Pages: Write` access for this account

Use an Account API Token rather than a User API Token so deployment is not tied
to an individual Cloudflare profile. The Pages project should not also be
connected to Cloudflare's Git builds; leave GitHub Actions as the deploy source
to avoid duplicate builds.

For a manual deploy from the local checkout:

```sh
hugo --gc --minify
npx wrangler pages deploy public --project-name arjenzhou --branch main
```

## Cloudflare Worker OAuth Proxy

Decap CMS uses a standalone Worker for GitHub OAuth:

- Worker source: `workers/decap-oauth/`
- Worker name: `arjenzhou-decap-oauth`
- Recommended custom domain: `decap-oauth.arjenzhou.com`
- Health check: `https://decap-oauth.arjenzhou.com/health`

Create a GitHub OAuth app:

```txt
Homepage URL: https://arjenzhou.com
Authorization callback URL: https://decap-oauth.arjenzhou.com/callback
```

Set the Worker secrets and deploy:

```sh
echo "<github-client-id>" | npx wrangler secret put GITHUB_CLIENT_ID --config workers/decap-oauth/wrangler.jsonc
echo "<github-client-secret>" | npx wrangler secret put GITHUB_CLIENT_SECRET --config workers/decap-oauth/wrangler.jsonc
npx wrangler deploy --config workers/decap-oauth/wrangler.jsonc
```

The Worker config attaches `decap-oauth.arjenzhou.com` as a custom domain during
deployment.

## Decap CMS

The CMS is available at `/admin/` and writes content back to the `main` branch
through the Decap GitHub backend.

CMS users must sign in with a GitHub account that has write access to this
repository.

Images uploaded from Decap CMS are committed under `content/pic/uploads/` and
served from `/pic/uploads/`.

## Local development

```sh
hugo server --buildDrafts
```

To try Decap CMS locally, run a local backend server and open `/admin/` from the
Hugo dev server:

```sh
npx decap-server
```
