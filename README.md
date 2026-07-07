# 记账本

简洁轻薄的个人记账 PWA。手动快速记账 + 银行 CSV 账单导入 + 月度花销分析。

## 本地运行

```bash
npm install
npm run dev
```

没配置 Supabase 时会显示配置引导页，也可以点"用演示数据体验一下"直接试用。

## 接入 Supabase（真实数据）

1. 在 [supabase.com](https://supabase.com) 创建免费项目
2. Dashboard → SQL Editor 里运行 `supabase/migrations/001_init.sql`
3. 复制 `.env.example` 为 `.env.local`，填入 Settings → API 里的 Project URL 和 anon key
4. 重启 `npm run dev`，用邮箱 magic link 登录

## 部署（Vercel）

推到 GitHub 后在 Vercel 导入仓库，环境变量里配置 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY`。
部署后在 Supabase Dashboard → Authentication → URL Configuration 里把 Site URL 改成线上域名（magic link 跳转用）。

手机 Safari/Chrome 打开线上地址 → 分享 → 添加到主屏幕，即可当 app 使用。
