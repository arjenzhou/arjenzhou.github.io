# arjenzhou.github.io

Hugo source lives on the `master` branch. Cloudflare Pages builds the site from
source and publishes the generated `public/` directory.

## Cloudflare Pages

Cloudflare Pages reads the Pages output directory from `wrangler.jsonc`:

- Build command: `hugo --gc --minify`
- Publish directory: `public`
- Production branch: `master`

Create the Pages project from the Cloudflare dashboard by connecting this GitHub
repository, or create it from Wrangler and deploy `public/` directly:

```sh
hugo --gc --minify
npx wrangler pages deploy public --project-name arjenzhou-blog --branch master
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

After the Worker is deployed, add the custom domain
`decap-oauth.arjenzhou.com` to the Worker in Cloudflare.

## Decap CMS

The CMS is available at `/admin/` and writes content back to the `master` branch
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
