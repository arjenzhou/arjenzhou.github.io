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

## Pages CMS

Content editing is handled by Pages CMS using the repository-level
`.pages.yml` config. Pages CMS writes Markdown files back to the `main` branch,
and those commits trigger the same GitHub Actions deployment workflow.

Install or open Pages CMS for this repository:

- Hosted CMS: https://app.pagescms.org/
- Config file: `.pages.yml`
- Editable content: `content/article`, `content/weekly`, `content/translation`,
  `content/reproduction`, and selected index pages
- Uploaded images: `content/pic/uploads/`, served from `/pic/uploads/`

CMS users need GitHub write access to this repository. There is no site-local
`/admin/` panel and no standalone OAuth Worker in this setup.

## Local development

```sh
hugo server --buildDrafts
```
