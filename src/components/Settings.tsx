import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Settings({
  onClose,
  toast,
}: {
  onClose: () => void
  toast: (msg: string) => void
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ''))
  }, [])

  async function savePassword(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 6) return toast('密码至少 6 位')
    if (password !== confirm) return toast('两次输入的密码不一致')
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) toast(`设置失败：${error.message}`)
    else {
      toast('密码已设置，手机上可用密码登录了')
      setPassword('')
      setConfirm('')
    }
  }

  async function logout() {
    await supabase.auth.signOut()
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-ink/40" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-t-2xl bg-paper p-5 pb-safe"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-hairline" />
        <h2 className="text-lg font-bold">设置</h2>
        <p className="mt-1 text-xs text-stone">当前账号：{email}</p>

        <form onSubmit={savePassword} className="mt-5 space-y-3">
          <p className="text-[13px] font-medium text-ink-soft">
            登录密码（手机 App 里用密码登录，无需等邮件）
          </p>
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="新密码（至少 6 位）"
            className="w-full rounded-xl border border-hairline bg-paper-raised px-4 py-3 text-[15px] outline-none focus:border-seal"
          />
          <input
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="再输一遍"
            className="w-full rounded-xl border border-hairline bg-paper-raised px-4 py-3 text-[15px] outline-none focus:border-seal"
          />
          <button
            type="submit"
            disabled={busy || !password}
            className="w-full rounded-xl bg-ink py-3 text-sm font-semibold text-paper disabled:opacity-50"
          >
            {busy ? '保存中…' : '保存密码'}
          </button>
        </form>

        <button
          onClick={logout}
          className="mt-6 mb-2 w-full rounded-xl border border-hairline py-3 text-sm font-medium text-seal"
        >
          退出登录
        </button>
      </div>
    </div>
  )
}
