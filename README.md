# domain-sale

基于 Cloudflare Workers 的**多域名共用极简出售页**。一个 Worker 根据访问域名自动展示其名称、售价和联系邮箱。

项目保持零管理后台、零数据库、无买家资料收集。

- GitHub：<https://github.com/wwvvv/domain-sale>
- Cloudflare 预览：<https://domain-sale-preview.ddli.workers.dev/?preview=example.com>
- 视觉参考：[LaunchPage.xyz](https://github.com/simplebytes-com/launchpage.xyz)（MIT，本站源码为独立实现）

## 日常维护：直接在 ChatGPT 当前会话中提出需求

不需要打开管理后台，也不需要在浏览器填写 GitHub 令牌。可以直接告诉助手：

- 「新增待售域名 example.org，售价 6800 元，联系邮箱 sale@example.org。」
- 「把 example.org 的售价改为 9800 元。」
- 「example.org 已售出。」
- 「暂停 example.net 的出售。」
- 「这 20 个域名使用同一个邮箱，按下面的清单批量更新……」

在获得授权后，助手会通过已连接的 GitHub 工具修改 `src/domains.json`、检查测试结果，并更新 Cloudflare **预览 Worker**。每次仍应核实源码已提交且部署成功；目前不会因为提交 GitHub 自动发布 Cloudflare。

**没有添加或更改任何正式域名的绑定、DNS 或现有网站设置。** 将真实域名连接到 Worker 是独立操作，需要你明确提出上线请求。

## 域名配置

唯一需要维护的出售清单文件：[src/domains.json](src/domains.json)。

```json
{
  "example.com": {
    "price": 8888,
    "currency": "CNY",
    "contact": "seller@example.com",
    "status": "for_sale"
  },
  "example.net": {
    "price": 12800,
    "currency": "CNY",
    "contact": "seller@example.com",
    "status": "for_sale"
  }
}
```

上述是演示数据，不代表已接入或实际出售中的域名。

| 字段 | 说明 |
| --- | --- |
| 配置对象的键 | 待售域名，使用规范的小写域名，不带协议、端口、`www.` 和路径 |
| `price` | 数值型售价（出售中必须大于 0，最多两位小数） |
| `currency` | 三位币种代码（例如 CNY、USD、SGD） |
| `contact` | 用于 `mailto:` 联系按钮的公开邮箱 |
| `status` | `for_sale`、`paused`、`reserved`、`sold` |

只有 `for_sale` 会显示出售页面，其他状态及不存在的域名均返回 HTTP 404。

`www.example.com` 与 `example.com` 在代码中归并为同一份数据。但是否能实际访问 `www`，仍取决于 Cloudflare 是否为该主机名配置单独入口。

## 本地检查

需要 Node.js 22+：

```bash
npm install
npm run check:domains
npm test
npx wrangler deploy --dry-run --outdir dist
```

GitHub Actions 自动进行以上配置验证、单元测试及 Wrangler dry-run，**不会自动发布到线上**。

## Cloudflare 测试与上线

当前 Worker 名称为 `domain-sale-preview`，在 Cloudflare 主账号中仅开放 `workers.dev`。预览示例：

```text
https://domain-sale-preview.ddli.workers.dev/?preview=example.com
```

预览仅能查看配置中存在、且状态为 `for_sale` 的域名。预览地址返回 `noindex`、`no-store`，不带 `preview` 参数的根路径返回 404。

正式上线需要先确认待售域名已托管到目标 Cloudflare 账号，并通过 Worker Custom Domain 逐一接入。**不要将现有正在提供服务的主域名误绑定为出售页。**

## 安全边界

- 公共仓库的配置文件对所有人可见：不要存储密码、API Token 或其他隐私凭据。
- 管理后台、CSV 上传、GitHub PAT 浏览器输入和 Playwright 管理 UI 已从源码移除。
- 所有配置修改保留 GitHub 版本历史，出现错误可以回滚。
- 开发用 `example.com`、`example.net` 在接入真实域名前应按需替换。
