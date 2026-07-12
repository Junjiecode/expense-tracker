import { useEffect, useState } from 'react'
import { supabase, isConfigured } from '../lib/supabase'
import { fetchAllTransactions, fetchTransactions } from '../lib/db'
import { exportTransactionsCsv } from '../lib/export'
import { getCurrency, monthKey, setCurrency } from '../lib/format'
import type { Currency } from '../lib/format'
import { getThemeMode, setThemeMode } from '../lib/theme'
import type { ThemeMode } from '../lib/theme'
import type { Category } from '../lib/types'
import RecurringSection from './Recurring'

const CURRENCIES: { symbol: Currency; label: string }[] = [
  { symbol: '€', label: '欧元' },
  { symbol: '¥', label: '人民币' },
]

const THEMES: { mode: ThemeMode; label: string }[] = [
  { mode: 'light', label: '浅色' },
  { mode: 'dark', label: '深色' },
  { mode: 'system', label: '跟随系统' },
]

export default function Settings({
  onClose,
  toast,
  categories,
  onCurrencyChange,
  onDataChange,
}: {
  onClose: () => void
  toast: (msg: string) => void
  categories: Category[]
  onCurrencyChange?: (c: Currency) => void
  /** 固定收支记入账目后通知外层刷新 */
  onDataChange?: () => void
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [exportMonth, setExportMonth] = useState(monthKey())
  const [exporting, setExporting] = useState(false)
  const [currency, setCurrencyState] = useState(getCurrency())
  const [themeMode, setThemeModeState] = useState(getThemeMode())

  function switchCurrency(c: Currency) {
    setCurrency(c)
    setCurrencyState(c)
    onCurrencyChange?.(c)
  }

  function switchTheme(m: ThemeMode) {
    setThemeMode(m)
    setThemeModeState(m)
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
    if (!isConfigured) return // 演示模式没有 supabase 客户端
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
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="max-h-[90dvh] w-full max-w-lg overflow-y-auto overscroll-contain rounded-t-2xl bg-paper p-5 pb-safe"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-hairline" />
        <div className="flex items-start justify-between">
          <h2 className="text-lg font-bold">设置</h2>
          <button
            onClick={onClose}
            aria-label="关闭"
            className="-mt-1.5 -mr-1.5 rounded-lg p-2.5 text-stone active:bg-hairline active:text-ink"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path
                d="M4 4l10 10M14 4L4 14"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        <p className="mt-1 text-xs text-stone">{isConfigured ? `当前账号：${email}` : '演示模式'}</p>

        {isConfigured && (
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
        )}

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

        <div className="mt-6 border-t border-hairline pt-5">
          <RecurringSection categories={categories} toast={toast} onDataChange={onDataChange} />
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

        <div className="mt-6 space-y-3 border-t border-hairline pt-5">
          <p className="text-[13px] font-medium text-ink-soft">外观</p>
          <div className="flex gap-2">
            {THEMES.map(({ mode, label }) => (
              <button
                key={mode}
                onClick={() => switchTheme(mode)}
                className={`flex-1 rounded-xl border py-2.5 text-sm ${
                  themeMode === mode
                    ? 'border-seal bg-seal/5 font-semibold text-seal'
                    : 'border-hairline bg-paper-raised font-medium text-ink-soft active:bg-hairline'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {isConfigured && (
          <button
            onClick={logout}
            className="mt-6 mb-2 w-full rounded-xl border border-hairline py-3 text-sm font-medium text-seal"
          >
            退出登录
          </button>
        )}
      </div>
    </div>
  )
}
