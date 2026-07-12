# 记账本 App

移动端优先的个人记账 PWA。核心原则：**简洁、实用、轻薄** —— 不随意加依赖、不加没被要求的功能。
2026-07-07 完成 v1 并上线，已在用户 iPhone 上作为主屏幕 App 正常使用。

## 线上环境（都已接通，勿重复搭建）

| 项 | 值 |
|---|---|
| 生产地址 | https://expense-tracker-steel-iota.vercel.app |
| GitHub 仓库 | Junjiecode/expense-tracker（私有），push main 自动部署 |
| Vercel 项目 | junjiecodes-projects/expense-tracker（Vite preset，环境变量已配） |
| Supabase 项目 | ref `fdkbphitekmzsvebrrkz`，组织 Junjiecode's Org，项目名 expense_tracker |
| 用户账号 | you756134440@gmail.com（密码登录） |
| 本地密钥 | `.env.local`（VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY，用 publishable key） |

Supabase Auth 配置：Site URL = 生产地址；Redirect URLs 含 `http://localhost:5173`。

## 技术栈

- Vite + React 19 + TypeScript，纯 SPA（无服务端、无路由库、无状态管理库）
- Tailwind CSS v4（主题 token 在 `src/index.css` 的 `@theme` 块）
- Supabase：Postgres + Auth + RLS，客户端直连
- Recharts（图表）、PapaParse（浏览器端 CSV 解析）、vite-plugin-pwa
- Import 和 Dashboard 页面用 React.lazy 按需加载（Recharts/PapaParse 不进首屏包）

## 命令

- `npm run dev` — 开发服务器（localhost:5173）
- `npm run build` — 类型检查 + 构建（tsc -b && vite build）

## 结构

- `src/pages/` — 四个 tab 页：Add（记一笔）/ List（账单）/ Import（CSV 导入）/ Dashboard（分析），由 `App.tsx` 里的 state 切换
- `src/pages/Login.tsx` — 密码优先登录，magic link 作 fallback
- `src/components/Settings.tsx` — 分析页右上角齿轮弹出：设置密码、CSV 导出、固定收支模板、分类管理、货币、外观（主题）、退出登录；演示模式下也可打开（账号相关区块隐藏）
- `src/components/Recurring.tsx` + `src/lib/recurring.ts` — 固定收支模板（v1.4）：设置面板里增删改模板项（名称/金额/分类/每月几号），「记入本月」弹确认单生成当月真实账目；嵌套弹层用 z-40（设置面板是 z-30）
- `src/components/CategoryManager.tsx` — 分类管理（v1.5）：设置面板里增删改分类（名称/emoji 图标/颜色/类型），颜色只能从 11 个已校验种子色里选（不开自由取色，深色映射才有对应）；删除分类靠 FK：账目 set null 变未分类、规则级联删除，无迁移；分类变更经 `onCategoriesChange` 一路回传到 App 的 `loadCategories` 刷新全局
- `src/lib/db.ts` — 所有 Supabase 读写都走这里，不要在组件里直接调 supabase.from()；演示模式时自动切到 `mockDb.ts`（内存假数据，仅在未配置 Supabase 时生效）
- `src/lib/format.ts` — 金额/日期格式化；日期一律用本地时区 `todayStr()`，禁止 `toISOString().slice(0,10)`（会跳 UTC 日期）
- `src/lib/export.ts` — CSV 导出（BOM + 转义 + Blob 下载）；入口在设置面板（全部/按月）和账单页头部（当月）
- `src/lib/theme.ts` — 深色模式：localStorage `theme` 键（缺省跟随系统），`html[data-theme]` 驱动 index.css 里的变量覆写；`index.html` 有首帧防闪内联脚本
- `src/components/charts/` — 分析页图表组件与 `chartTheme.ts`（图表 SVG 不认 CSS 变量，浅/深两组 hex 在这里，与 index.css 保持同步；分类色深色映射表也在这里）
- `supabase/migrations/` — 建表 SQL；改表结构时新增编号文件（004_xxx.sql），去 Supabase Dashboard → SQL Editor 手动执行，不改旧文件（001–003 均已执行）
- `scripts/backup.mjs` + `.github/workflows/backup.yml` — 月度自动备份：每月 1 号 03:30 UTC 用密码登录（走 RLS，4 个 GitHub Secrets：SUPABASE_URL / SUPABASE_ANON_KEY / BACKUP_EMAIL / BACKUP_PASSWORD）导出全部账目 CSV，提交到 `backups` 分支 `monthly/` 下；vercel.json 已禁用该分支的部署；CSV 列格式与 `src/lib/export.ts` 保持一致；手动测试 `gh workflow run monthly-backup`。注意 GitHub 会停用 60 天无活动仓库的定时任务（备份自身的月度提交即算活动，正常自续）

## 数据约定

- `transactions.amount` 始终为正数，方向由 `type`（expense/income）决定
- CSV 导入去重靠 `import_hash = sha256(date|amount|type|description)`，同文件内重复行追加序号；`(user_id, import_hash)` 有唯一部分索引兜底
- `category_rules` 按关键词包含匹配给导入行自动分类，最长关键词优先；导入时用户手动指定的分类会自动沉淀为规则；`(user_id, keyword)` 唯一，`saveRule` 用 upsert（冲突更新为最新分类）
- CSV 列映射按表头签名存 localStorage（`csv-mappings`），同一银行第二次导入免配置
- 固定收支记入的账目是普通 manual 账目（不加新 source），幂等靠 `import_hash = 'rec:{item_id}:{YYYY-MM}'` + 既有 `(user_id, import_hash)` 唯一部分索引；`rec:` 前缀与 CSV 的 sha256 hex 天然不冲突
- 所有表开 RLS（`auth.uid() = user_id`）；新用户注册触发器自动建 11 个默认分类

## 设计语言（中式账本）

- 配色 token：`paper` 纸白底 / `ink` 墨色文字 / `seal` 朱砂红（支出、强调、保存印章）/ `income` 松绿（收入）
- 分类颜色存在 `categories.color`，是通过 dataviz skill 色觉安全校验的色板，改动前先跑 validate_palette.js
- 金额数字加 `.num` class（tabular-nums）
- 签名元素：保存键是方形朱砂"记"字印章，按下有盖章动效（`.stamping`）

## 踩过的坑（重要，别再踩）

1. **git 提交邮箱**：本仓库已 `git config user.email "121383179+Junjiecode@users.noreply.github.com"`。用户全局 git 邮箱是工作邮箱（adevinta.com），用它提交会被 Vercel 免费版 **Block 部署**（commit email 匹配不到 GitHub 账号）
2. **iOS PWA 与 Safari 存储隔离**：magic link 在主屏幕 PWA 里走不通（邮件链接跳去 Safari），所以登录必须密码优先。别把登录改回纯 magic link
3. **Supabase 免费版邮件限制**：内置邮件服务约每小时 2 封，且**不配自定义 SMTP 不能改邮件模板**（所以邮件里没有 OTP 验证码，验证码登录方案不可行）
4. **Supabase 新版密钥**：项目用的是 `sb_publishable_...`（填在 anon key 位置，行为一致）。secret key 曾在聊天中暴露过，已建议用户 rotate，任何情况下都不要用它、不要写进文件
5. **改 Supabase Auth 配置 / 跑 SQL**：用 Chrome 浏览器工具操作用户已登录的 Dashboard（用户 Gmail 连接的是 junjiefr@gmail.com，读不到 you756134440@gmail.com 的邮件）

## 可能的后续方向（用户未确认，仅备忘）

预算提醒、多币种、规则管理（查看/删除自动分类规则）、离线支持（目前 SW 只缓存壳，数据在线才有）
