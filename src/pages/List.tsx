import { useEffect, useMemo, useState } from 'react'
import type { Category, Transaction, TxType } from '../lib/types'
import { deleteTransaction, fetchTransactions, updateTransaction } from '../lib/db'
import { CURRENCY, fmtDateLabel, fmtMoney, monthKey, todayStr } from '../lib/format'
import MonthSwitcher from '../components/MonthSwitcher'
import CategoryGrid from '../components/CategoryGrid'
import { exportTransactionsCsv } from '../lib/export'

interface Props {
  categories: Category[]
  toast: (msg: string) => void
}

export default function List({ categories, toast }: Props) {
  const [month, setMonth] = useState(monthKey())
  const [txs, setTxs] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])

  async function load() {
    setLoading(true)
    try {
      setTxs(await fetchTransactions(month))
    } catch (e) {
      toast(`加载失败：${(e as Error).message}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month])

  const groups = useMemo(() => {
    const byDate = new Map<string, Transaction[]>()
    for (const t of txs) {
      const list = byDate.get(t.date) ?? []
      list.push(t)
      byDate.set(t.date, list)
    }
    return Array.from(byDate.entries())
  }, [txs])

  const totalExpense = txs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const totalIncome = txs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)

  return (
    <div className="px-4 pt-safe">
      <div className="sticky top-0 z-10 -mx-4 bg-paper/95 px-4 pt-3 pb-2 backdrop-blur">
        <div className="relative">
          <MonthSwitcher month={month} onChange={setMonth} />
          <button
            onClick={() => {
              if (txs.length === 0) return toast('这个月没有账目可导出')
              exportTransactionsCsv(txs, categories, `记账本-${month}.csv`)
              toast(`已导出 ${txs.length} 条`)
            }}
            aria-label="导出本月 CSV"
            className="absolute right-0 top-1/2 -translate-y-1/2 p-2 text-stone active:text-ink"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 4v10m0 0-4-4m4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M5 17v3h14v-3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
        <p className="text-center text-xs text-stone">
          支出 <span className="num">{CURRENCY}{fmtMoney(totalExpense)}</span>
          <span className="mx-2">·</span>
          收入 <span className="num">{CURRENCY}{fmtMoney(totalIncome)}</span>
        </p>
      </div>

      {loading ? (
        <p className="py-16 text-center text-sm text-stone">加载中…</p>
      ) : groups.length === 0 ? (
        <div className="py-20 text-center">
          <p className="text-4xl">📖</p>
          <p className="mt-3 text-sm text-stone">这个月还没有账目，去「记一笔」开始吧</p>
        </div>
      ) : (
        <div className="space-y-5 pt-3">
          {groups.map(([date, list]) => {
            const dayExpense = list
              .filter((t) => t.type === 'expense')
              .reduce((s, t) => s + t.amount, 0)
            return (
              <section key={date}>
                <div className="flex items-baseline justify-between border-b border-hairline pb-1.5">
                  <h3 className="text-[13px] font-medium text-ink-soft">{fmtDateLabel(date)}</h3>
                  {dayExpense > 0 && (
                    <span className="num text-xs text-stone">
                      支 {CURRENCY}{fmtMoney(dayExpense)}
                    </span>
                  )}
                </div>
                <ul>
                  {list.map((t) => {
                    const cat = t.category_id ? catMap.get(t.category_id) : undefined
                    return (
                      <li key={t.id}>
                        <button
                          onClick={() => setEditing(t)}
                          className="flex w-full items-center gap-3 py-2.5 text-left active:bg-paper-raised"
                        >
                          <span
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base"
                            style={{ backgroundColor: `${cat?.color ?? '#8A8A82'}1A` }}
                          >
                            {cat?.icon ?? '❓'}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[15px]">
                              {cat?.name ?? '未分类'}
                            </span>
                            {(t.note || t.description) && (
                              <span className="block truncate text-xs text-stone">
                                {t.note || t.description}
                              </span>
                            )}
                          </span>
                          <span
                            className={`num text-[15px] font-semibold ${
                              t.type === 'income' ? 'text-income' : ''
                            }`}
                          >
                            {t.type === 'income' ? '+' : '−'}
                            {fmtMoney(t.amount)}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )
          })}
        </div>
      )}

      {editing && (
        <EditSheet
          tx={editing}
          categories={categories}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            load()
          }}
          toast={toast}
        />
      )}
    </div>
  )
}

function EditSheet({
  tx,
  categories,
  onClose,
  onSaved,
  toast,
}: {
  tx: Transaction
  categories: Category[]
  onClose: () => void
  onSaved: () => void
  toast: (msg: string) => void
}) {
  const [amount, setAmount] = useState(String(tx.amount))
  const [type, setType] = useState<TxType>(tx.type)
  const [categoryId, setCategoryId] = useState<string | null>(tx.category_id)
  const [date, setDate] = useState(tx.date)
  const [note, setNote] = useState(tx.note || tx.description)
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function save() {
    const value = parseFloat(amount)
    if (!value || value <= 0) return toast('金额无效')
    setBusy(true)
    try {
      await updateTransaction(tx.id, {
        amount: value,
        type,
        category_id: categoryId,
        date,
        note,
      })
      toast('已保存')
      onSaved()
    } catch (e) {
      toast(`保存失败：${(e as Error).message}`)
      setBusy(false)
    }
  }

  async function remove() {
    if (!confirmDelete) return setConfirmDelete(true)
    setBusy(true)
    try {
      await deleteTransaction(tx.id)
      toast('已删除')
      onSaved()
    } catch (e) {
      toast(`删除失败：${(e as Error).message}`)
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-ink/40" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-t-2xl bg-paper p-5 pb-safe"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-hairline" />

        <div className="mb-4 flex items-center gap-3">
          <div className="flex rounded-full border border-hairline bg-paper-raised p-0.5">
            {(['expense', 'income'] as TxType[]).map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`rounded-full px-3.5 py-1 text-xs ${
                  type === t
                    ? t === 'expense'
                      ? 'bg-seal font-semibold text-white'
                      : 'bg-income font-semibold text-white'
                    : 'text-stone'
                }`}
              >
                {t === 'expense' ? '支出' : '收入'}
              </button>
            ))}
          </div>
          <input
            type="number"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="num flex-1 rounded-lg border border-hairline bg-paper-raised px-3 py-2 text-right text-lg font-semibold outline-none focus:border-seal"
          />
        </div>

        <div className="max-h-48 overflow-y-auto pb-1">
          <CategoryGrid
            categories={categories}
            type={type}
            selected={categoryId}
            onSelect={setCategoryId}
          />
        </div>

        <div className="mt-4 flex gap-2">
          <input
            type="date"
            value={date}
            max={todayStr()}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="rounded-lg border border-hairline bg-paper-raised px-3 py-2 text-sm outline-none"
          />
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="备注"
            className="flex-1 rounded-lg border border-hairline bg-paper-raised px-3 py-2 text-sm outline-none focus:border-seal"
          />
        </div>

        <div className="mt-5 flex gap-3">
          <button
            onClick={remove}
            disabled={busy}
            className={`rounded-xl border px-4 py-3 text-sm font-medium disabled:opacity-50 ${
              confirmDelete
                ? 'border-seal bg-seal text-white'
                : 'border-hairline text-seal'
            }`}
          >
            {confirmDelete ? '确认删除' : '删除'}
          </button>
          <button
            onClick={save}
            disabled={busy}
            className="flex-1 rounded-xl bg-ink py-3 text-sm font-semibold text-paper disabled:opacity-50"
          >
            保存修改
          </button>
        </div>
      </div>
    </div>
  )
}
