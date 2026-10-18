# domain-sale

Minimal multi-domain sale landing page on Cloudflare Workers. One Worker, multiple domain names, independent prices and email contacts.

## Setup

1. Edit `src/domains.json` with real domains, prices and public contact emails.
2. `npm install`
3. `npm test`
4. `npm run dev`
5. `npm run deploy` (workers.dev preview only; no custom domains are configured)

For local testing: `curl -H "Host: example.com" http://127.0.0.1:8787/`

**No production DNS or custom domain binding is included.** Unrecognized domains return 404. Preview example: `https://<worker>.<account>.workers.dev/?preview=example.com`. This works only on a `workers.dev` Host and only for configured sample domains. The preview has `noindex` and `no-store` headers; its bare root intentionally returns 404. Production domains ignore the `preview` parameter.

## Inspiration

UI inspired by [LaunchPage.xyz](https://github.com/simplebytes-com/launchpage.xyz) (MIT). This is an independent implementation, not a copy of its source.
