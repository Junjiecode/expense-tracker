# 记账本 App

移动端优先的个人记账 PWA。核心原则：**简洁、实用、轻薄** —— 不随意加依赖、不加没被要求的功能。

## 技术栈

- Vite + React 19 + TypeScript，纯 SPA（无服务端）
- Tailwind CSS v4（主题 token 定义在 `src/index.css` 的 `@theme` 块）
- Supabase：Postgres + Auth（邮箱 magic link）+ RLS，客户端直连
- Recharts（图表）、PapaParse（浏览器端 CSV 解析）
- vite-plugin-pwa（manifest + service worker 配置在 `vite.config.ts`）

## 命令

- `npm run dev` — 开发服务器
- `npm run build` — 类型检查 + 构建（tsc -b && vite build）

## 结构

- `src/pages/` — 四个 tab 页：Add（记一笔）/ List（账单）/ Import（CSV 导入）/ Dashboard（分析），由 `App.tsx` 里的 state 切换，无路由库
- `src/lib/db.ts` — 所有 Supabase 读写都走这里，不要在组件里直接调 supabase.from()
- `src/lib/format.ts` — 金额/日期格式化；日期一律用本地时区 `todayStr()`，禁止 `toISOString().slice(0,10)`（会跳 UTC 日期）
- `supabase/migrations/` — 建表 SQL，改表结构时新增编号文件，不改旧文件

## 数据约定

- `transactions.amount` 始终为正数，方向由 `type`（expense/income）决定
- CSV 导入去重靠 `import_hash = sha256(date|amount|type|description)`，同文件内重复行追加序号；`(user_id, import_hash)` 有唯一索引兜底
- `category_rules` 按关键词包含匹配给导入行自动分类，最长关键词优先

## 设计语言（中式账本）

- 配色 token：`paper` 纸白底 / `ink` 墨色文字 / `seal` 朱砂红（支出、强调、保存印章）/ `income` 松绿（收入）
- 分类颜色存在数据库 `categories.color`，是通过色觉安全校验的色板，改动前先用 dataviz skill 的 validate_palette.js 校验
- 金额数字加 `.num` class（tabular-nums）
- 签名元素：保存键是方形朱砂"记"字印章，按下有盖章动效（`.stamping`）
