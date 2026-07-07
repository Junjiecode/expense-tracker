import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'password' | 'magic'>('password')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function friendly(msg: string): string {
    if (msg.includes('rate limit')) return '邮件发送太频繁，请约 1 小时后再试'
    if (msg.includes('Invalid login credentials')) return '邮箱或密码不对'
    return msg
  }

  async function loginWithPassword(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (error) setError(friendly(error.message))
    // 成功后 onAuthStateChange 自动进入账本
  }

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })
    setBusy(false)
    if (error) setError(friendly(error.message))
    else setSent(true)
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-8">
      <div className="mb-10 flex flex-col items-center gap-4">
        <span className="flex h-16 w-16 items-center justify-center rounded-lg bg-seal text-3xl font-bold text-white shadow-sm">
          记
        </span>
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-wide">记账本</h1>
          <p className="mt-1 text-sm text-stone">每一笔，都有账可查</p>
        </div>
      </div>

      {mode === 'password' ? (
        <form onSubmit={loginWithPassword} className="space-y-3">
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="邮箱地址"
            className="w-full rounded-xl border border-hairline bg-paper-raised px-4 py-3.5 text-[15px] outline-none focus:border-seal"
          />
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="密码"
            className="w-full rounded-xl border border-hairline bg-paper-raised px-4 py-3.5 text-[15px] outline-none focus:border-seal"
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-seal py-3.5 font-semibold text-white active:bg-seal-deep disabled:opacity-50"
          >
            {busy ? '登录中…' : '登录'}
          </button>
          {error && <p className="text-center text-sm text-seal">{error}</p>}
          <button
            type="button"
            onClick={() => {
              setMode('magic')
              setError(null)
            }}
            className="w-full py-2 text-center text-xs text-stone"
          >
            还没设密码？用邮件链接登录
          </button>
          <p className="text-center text-xs text-stone/80">
            首次用邮件链接登录后，可在 分析 → 设置 里设置密码
          </p>
        </form>
      ) : sent ? (
        <div className="rounded-xl border border-hairline bg-paper-raised p-6 text-center">
          <p className="font-medium">登录邮件已发送</p>
          <p className="mt-2 text-sm text-ink-soft">
            去 <b>{email}</b> 的收件箱点击登录链接。
            <br />
            登录后记得在 分析 → 设置 里设个密码，手机 App 里用密码登录最稳。
          </p>
        </div>
      ) : (
        <form onSubmit={sendMagicLink} className="space-y-3">
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="邮箱地址"
            className="w-full rounded-xl border border-hairline bg-paper-raised px-4 py-3.5 text-[15px] outline-none focus:border-seal"
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-seal py-3.5 font-semibold text-white active:bg-seal-deep disabled:opacity-50"
          >
            {busy ? '发送中…' : '发送登录链接'}
          </button>
          {error && <p className="text-center text-sm text-seal">{error}</p>}
          <button
            type="button"
            onClick={() => {
              setMode('password')
              setError(null)
            }}
            className="w-full py-2 text-center text-xs text-stone"
          >
            用密码登录
          </button>
        </form>
      )}
    </div>
  )
}
