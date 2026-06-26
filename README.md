# arjenzhou.github.io

Hugo source lives on the `master` branch. Netlify builds the site from source and
publishes the generated `public/` directory.

## Netlify setup

This repository is connected to the Netlify project
[`arjenzhou-blog`](https://app.netlify.com/projects/arjenzhou-blog).

Netlify reads the build settings from `netlify.toml`:

- Build command: `hugo --gc --minify`
- Publish directory: `public`
- Production branch: `master`

The custom domain `arjenzhou.com` is attached to the Netlify project. If DNS is
managed outside Netlify, point the apex domain to Netlify:

- Preferred: ALIAS/ANAME/flattened CNAME for `@` to
  `apex-loadbalancer.netlify.com`
- Fallback: A record for `@` to `75.2.60.5`
- Optional `www`: CNAME to `arjenzhou-blog.netlify.app`

## Decap CMS

The CMS is available at `/admin/` and writes content back to the `master` branch
through the Decap GitHub backend.

To finish CMS login, configure a GitHub OAuth provider in Netlify at
Project configuration > Access & security > OAuth. Use
`https://api.netlify.com/auth/done` as the GitHub OAuth app callback URL. CMS
users must sign in with a GitHub account that has write access to this
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
