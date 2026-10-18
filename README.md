# domain-sale · 多域名极简出售页

一个 Cloudflare Worker 服务多个待售域名；每个域名可以配置独立售价、币种、联系邮箱和出售状态。无需数据库、VPS 或复杂后台。

- [GitHub 源码](https://github.com/wwvvv/domain-sale)
- [Workers 测试页（演示数据）](https://domain-sale-preview.ddli.workers.dev/?preview=example.com)
- 视觉理念参考 [LaunchPage.xyz](https://github.com/simplebytes-com/launchpage.xyz)（MIT），本项目采用独立实现。

## 本地可视化管理

在项目根目录执行（Node.js 22+，Windows / macOS / Linux 通用）：

    npm run admin

然后在浏览器打开 http://127.0.0.1:4173/admin/ 。

本地管理界面支持：
- 新增、编辑、删除域名；搜索、状态筛选。
- CSV/JSON 导入、合并、完全替换与导出。
- 重复域名检查、非法邮箱/售价提示和导入覆盖确认。
- 通过 GitHub Fine-grained PAT 创建一个新的审核 Pull Request。

本地管理页面**不会发布至 Cloudflare Worker**。Worker /admin 路径始终返回 404。编辑器本身不带账户数据库，也不接收买家的数据。

## 数据格式

所有信息保存在 [src/domains.json](src/domains.json)。配置例如：

    {
      "example.com": {
        "price": 8888,
        "currency": "CNY",
        "contact": "sale@example.com",
        "status": "for_sale"
      }
    }

字段含义：
- domain：域名，自动规范为小写并去掉 www. 前缀。
- price：出售中必须大于零，最多保留两位小数。
- currency：例如 CNY / USD / SGD 等三位代码。
- contact：有效的公开联系邮箱。
- status：for_sale（出售中）、paused（暂停）、reserved（预留）、sold（已售出）。

仅 for_sale 状态的域名能展示出售页，其余状态返回 404。

CSV 表头为：domain,price,currency,contact,status；也接受域名,售价,币种,邮箱,状态等中文表头。输出 CSV 带有 UTF-8 BOM，便于 Excel 读取。合并会明确提示覆盖的条数；替换模式会明确提示被移除的条数。

## GitHub 审核机制

1. 点击“同步 GitHub”，加载 main 分支最新出售配置。
2. 使用管理界面增删改或导入 CSV。
3. 选用 [GitHub Fine-grained Personal Access Token](https://github.com/settings/personal-access-tokens/new)，仅授权 wwvvv/domain-sale 仓库，将 Contents 和 Pull requests 权限设置为 Read and write。
4. 在本地管理页输入此令牌，点击“创建审核 PR”。
5. 管理器创建新分支及 PR，等待 GitHub CI 通过、人工审核，然后才能合并。

浏览器不会永久保存 PAT，也不会将 PAT 放到 URL、Cookie、LocalStorage 或仓库。PR 写入按钮只在 localhost / 127.0.0.1 启用；页面不依赖第三方 JS CDN。请注意，具有足够权限的浏览器扩展仍可能读取页面输入，请在可信环境中使用。

如果不想创建令牌，可以“导出 JSON”，使用 GitHub 原生网页在分支中替换配置，然后发起 PR。

要强制“审核通过后才部署”，还应进入仓库 Settings → Rules → Rulesets，针对 main 开启 Require a pull request before merging 和至少一名审核者。未配置保护规则时，有仓库写权限的人仍可能直接向 main 推送。

## GitHub Actions

[Validate](.github/workflows/validate.yml)：push / pull_request 时执行 Node.js 测试、语法检查及 Wrangler dry-run，永不发布。

[Deploy Preview](.github/workflows/deploy-preview.yml)：仅 main 分支变更或手动触发，并且仓库变量 DOMAIN_SALE_AUTO_DEPLOY 等于 true 才会实际部署。

首次启用自动部署前，打开 GitHub 仓库 Settings → Secrets and variables → Actions，配置：
- Secrets：CLOUDFLARE_API_TOKEN（最小权限的 Workers Scripts Edit 令牌）
- Secrets：CLOUDFLARE_ACCOUNT_ID（绑定目标 Cloudflare 账号的 Account ID）
- Variables：DOMAIN_SALE_AUTO_DEPLOY，设为 true

在配置上述 Secrets 和分支审核规则之前，请保持 DOMAIN_SALE_AUTO_DEPLOY 未设置，自动部署 Job 将显示 Skipped，这是刻意保留的安全开关。

自动部署只对 domain-sale-preview Worker 运行，校验 Wrangler 不包含 route、routes、env 或 triggers。提交代码不会新增任何自定义域名、修改现有 DNS 或覆盖其他 Worker。部署后会对 workers.dev 发起 HTTPS 冒烟测试。

## 本地开发

    npm install
    npm test
    npm run dev
    npx wrangler deploy --name domain-sale-preview --dry-run

预览只能在 workers.dev 上使用 ?preview=example.com 之类参数，前提是该域名存在于配置且状态为 for_sale。workers.dev 根路径返回 404，默认不允许索引。

**正式出售域名的第一次接入**仍需为相应主机名绑定 Cloudflare Worker Custom Domain。现阶段不做任何正式域名绑定；请勿将仍然运营的网站域名绑定到出售页。
