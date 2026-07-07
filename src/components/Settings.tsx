import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchAllTransactions, fetchTransactions } from '../lib/db'
import { exportTransactionsCsv } from '../lib/export'
import { getCurrency, monthKey, setCurrency } from '../lib/format'
import type { Currency } from '../lib/format'
import type { Category } from '../lib/types'

const CURRENCIES: { symbol: Currency; label: string }[] = [
  { symbol: '€', label: '欧元' },
  { symbol: '¥', label: '人民币' },
]

export default function Settings({
  onClose,
  toast,
  categories,
  onCurrencyChange,
}: {
  onClose: () => void
  toast: (msg: string) => void
  categories: Category[]
  onCurrencyChange?: (c: Currency) => void
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [exportMonth, setExportMonth] = useState(monthKey())
  const [exporting, setExporting] = useState(false)
  const [currency, setCurrencyState] = useState(getCurrency())

  function switchCurrency(c: Currency) {
    setCurrency(c)
    setCurrencyState(c)
    onCurrencyChange?.(c)
  }

  async function exportCsv(scope: 'month' | 'all') {
    setExporting(true)
    try {
      const txs =
        scope === 'month' ? await fetchTransactions(exportMonth) : await fetchAllTransactions()
      if (txs.length === 0) {
        toast(scope === 'month' ? '该月没有账目' : '还没有任何账目')
        return
      }
      const name = scope === 'month' ? `记账本-${exportMonth}.csv` : '记账本-全部.csv'
      exportTransactionsCsv(txs, categories, name)
      toast(`已导出 ${txs.length} 条`)
    } catch (e) {
      toast(`导出失败：${(e as Error).message}`)
    } finally {
      setExporting(false)
    }
  }

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

        <div className="mt-6 space-y-3 border-t border-hairline pt-5">
          <p className="text-[13px] font-medium text-ink-soft">导出数据（CSV，可用 Excel 打开）</p>
          <div className="flex gap-2">
            <input
              type="month"
              value={exportMonth}
              max={monthKey()}
              onChange={(e) => e.target.value && setExportMonth(e.target.value)}
              className="rounded-xl border border-hairline bg-paper-raised px-3 py-2.5 text-sm outline-none"
            />
            <button
              onClick={() => exportCsv('month')}
              disabled={exporting}
              className="flex-1 rounded-xl border border-hairline bg-paper-raised py-2.5 text-sm font-medium active:bg-hairline disabled:opacity-50"
            >
              导出该月
            </button>
          </div>
          <button
            onClick={() => exportCsv('all')}
            disabled={exporting}
            className="w-full rounded-xl border border-hairline bg-paper-raised py-2.5 text-sm font-medium active:bg-hairline disabled:opacity-50"
          >
            {exporting ? '导出中…' : '导出全部账目'}
          </button>
        </div>

        <div className="mt-6 space-y-3 border-t border-hairline pt-5">
          <p className="text-[13px] font-medium text-ink-soft">货币符号（仅显示，不折算金额）</p>
          <div className="flex gap-2">
            {CURRENCIES.map(({ symbol, label }) => (
              <button
                key={symbol}
                onClick={() => switchCurrency(symbol)}
                className={`flex-1 rounded-xl border py-2.5 text-sm ${
                  currency === symbol
                    ? 'border-seal bg-seal/5 font-semibold text-seal'
                    : 'border-hairline bg-paper-raised font-medium text-ink-soft active:bg-hairline'
                }`}
              >
                {symbol} {label}
              </button>
            ))}
          </div>
        </div>

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
