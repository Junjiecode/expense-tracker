import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function sendLink(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })
    setBusy(false)
    if (error) setError(error.message)
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

      {sent ? (
        <div className="rounded-xl border border-hairline bg-paper-raised p-6 text-center">
          <p className="font-medium">登录邮件已发送</p>
          <p className="mt-2 text-sm text-ink-soft">
            去 <b>{email}</b> 的收件箱点击登录链接，即可进入账本。
          </p>
        </div>
      ) : (
        <form onSubmit={sendLink} className="space-y-3">
          <input
            type="email"
            required
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
          <p className="pt-2 text-center text-xs text-stone">
            无需密码，点击邮件里的链接即可登录
          </p>
        </form>
      )}
    </div>
  )
}
