# domain-sale — 多域名极简出售页

基于 Cloudflare Workers 的多个域名共用出售页。**不需要后台、数据库、VPS**。直接在当前 ChatGPT 会话告诉我新增域名、改价、停售等即可维护。

## 首个真实待售域名

| 域名 | 售价 | 寓意 | 状态 |
|---|---:|---|---|
| **xiac.cn** | **¥6,666 CNY** | 下厨、夏创、虾吃、夏城 | 正在出售 |

**全站联系邮箱固定为 `i@ddli.cn`**，放在 [src/site.json](src/site.json)；每个域名的售价、状态及寓意在 [src/domains.json](src/domains.json)。演示域名 example.com、example.net 已从出售清单移除。

目前尚未将 `xiac.cn` 的 DNS 或自定义域名绑定到出售页。只开放 Cloudflare Workers 预览：

- [默认自动语言预览](https://domain-sale-preview.ddli.workers.dev/?preview=xiac.cn)
- [强制中文](https://domain-sale-preview.ddli.workers.dev/?preview=xiac.cn&lang=zh-CN)
- [强制英文](https://domain-sale-preview.ddli.workers.dev/?preview=xiac.cn&lang=en)
- [日语翻译预览](https://domain-sale-preview.ddli.workers.dev/?preview=xiac.cn&lang=ja)

## 国际化：translate.js

- **自动语言选择**：优先使用 URL `lang` 参数；否则依据浏览器 `navigator.languages` 选择语言。页面右上角可以手动切换。
- **简体中文和英语**：使用内置的可靠文案，无需额外网络请求。
- **其余语言**：仅在访问相应语种时按需加载由本站提供的固定版本 [xnx3/translate.js](https://github.com/xnx3/translate)，使用其 `client.edge` 微软翻译通道，无需 API Key。需联网访问微软翻译服务，翻译服务故障时回退英文，不影响域名、售价和联系方式。
- **中文寓意保持原字样**：`下厨`、`夏创`、`虾吃`、`夏城` 为中文谐音创意，不会自动机翻成意思错误的商业名称。

翻译库固定为 `4.1.0.20260526`，源代码来自 [xnx3/translate@df9d77c](https://github.com/xnx3/translate/commit/df9d77c85399470d10e2cb610f17e294ac107740)，本地存放于 `src/vendor/translate.min.json`（script 字段），其 MIT 协议在 `src/vendor/LICENSE`。浏览器通过 `/assets/translate.min.js` 按需获取，**不从不受控的最新 CDN 加载远程脚本**。但非中英文的文本翻译仍会发送页面文案到第三方翻译服务。页面不包含客户隐私数据。

## 配置格式

`src/domains.json`：

```json
{
  "xiac.cn": {
    "price": 6666,
    "currency": "CNY",
    "status": "for_sale",
    "meanings": ["下厨", "夏创", "虾吃", "夏城"]
  }
}
```

固定邮箱请只在 `src/site.json` 中维护，避免各域名重复填写。状态支持 `for_sale`、`paused`、`reserved`、`sold`。只有 `for_sale` 出售页可访问，其他状态及未知域名返回 404。

## 测试和部署

```bash
npm install
npm run check:domains
npm test
npx wrangler deploy --dry-run --outdir dist
```

GitHub Actions 自动运行校验、测试和 Wrangler dry-run，但**不会自动发布 Cloudflare**。仓库采用无后台模式，源码版本化以便回滚。

需要上线正式域名时，再单独为 `xiac.cn` 添加 Cloudflare Worker Custom Domain（若想 `www` 访问，也要单独处理）。**本次仅部署 Workers 预览，不修改任何正式域名 DNS、证书或者正在运行的网站。**
