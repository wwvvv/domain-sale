# domain-sale

Minimal multi-domain sale landing page on Cloudflare Workers. One Worker, multiple domain names, independent prices and email contacts.

## Setup

1. Edit `src/domains.json` with real domains, prices and public contact emails.
2. `npm install`
3. `npm test`
4. `npm run dev`
5. `npm run deploy` (workers.dev preview only; no custom domains are configured)

For local testing: `curl -H "Host: example.com" http://127.0.0.1:8787/`

**No production DNS or custom domain binding is included.** Unrecognized domains return 404. For testing on workers.dev, add the exact preview hostname to domains.json temporarily.

## Inspiration

UI inspired by [LaunchPage.xyz](https://github.com/simplebytes-com/launchpage.xyz) (MIT). This is an independent implementation, not a copy of its source.
