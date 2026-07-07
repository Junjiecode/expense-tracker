export default function SetupGuide({ onDemo }: { onDemo: () => void }) {
  return (
    <div className="mx-auto max-w-lg px-6 py-12">
      <div className="mb-8 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-md bg-seal text-lg font-bold text-white">
          记
        </span>
        <h1 className="text-xl font-bold">记账本 · 首次配置</h1>
      </div>
      <ol className="space-y-5 text-[15px] leading-relaxed text-ink-soft">
        <li>
          <b className="text-ink">1. 创建 Supabase 项目</b>
          <br />
          打开 supabase.com → New project（免费版即可），区域选离你近的。
        </li>
        <li>
          <b className="text-ink">2. 建表</b>
          <br />
          在 Dashboard → SQL Editor 里粘贴并运行项目里的{' '}
          <code className="rounded bg-hairline px-1">supabase/migrations/001_init.sql</code>。
        </li>
        <li>
          <b className="text-ink">3. 填入密钥</b>
          <br />
          在项目根目录创建 <code className="rounded bg-hairline px-1">.env.local</code>：
          <pre className="mt-2 overflow-x-auto rounded-lg bg-ink p-3 text-xs text-paper">
{`VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...`}
          </pre>
          两个值在 Dashboard → Settings → API 里。
        </li>
        <li>
          <b className="text-ink">4. 重启开发服务器</b>
          <br />
          <code className="rounded bg-hairline px-1">npm run dev</code> 重新运行后刷新本页。
        </li>
      </ol>
      <button
        onClick={onDemo}
        className="mt-8 w-full rounded-xl border border-hairline bg-paper-raised py-3 text-sm font-medium text-ink-soft active:bg-hairline"
      >
        先不配置，用演示数据体验一下
      </button>
    </div>
  )
}
