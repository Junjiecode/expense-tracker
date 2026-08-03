import { useEffect, useMemo, useState } from 'react'
import type { Category, RecurringItem, TxType } from '../lib/types'
import {
  deleteRecurringItem,
  fetchExistingHashes,
  insertRecurringItem,
  insertTransactions,
  updateRecurringItem,
  fetchRecurringItems,
} from '../lib/db'
import { buildRecurringTx, dayInMonth, recurringHash } from '../lib/recurring'
import { fmtMoney, fmtMonth, getCurrency, monthKey, prevMonth } from '../lib/format'
import CategoryGrid from './CategoryGrid'
import MonthSwitcher from './MonthSwitcher'

/** 金额输入闸门：整数最多 8 位、小数最多 2 位（与 Add/EditSheet 一致） */
const AMOUNT_RE = /^\d{1,8}(\.\d{0,2})?$/

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1)

/** 补记回溯上限：含当前月在内最近 12 个月 */
const BACKFILL_MONTHS = 12

interface SectionProps {
  categories: Category[]
  toast: (msg: string) => void
  /** 记入账目后通知外层刷新（Dashboard 数据）*/
  onDataChange?: () => void
}

/** 设置面板里的「固定收支」板块：模板列表 + 新增/编辑 + 记入本月 */
export default function RecurringSection({ categories, toast, onDataChange }: SectionProps) {
  const [items, setItems] = useState<RecurringItem[]>([])
  const [loadError, setLoadError] = useState(false)
  const [editing, setEditing] = useState<RecurringItem | 'new' | null>(null)
  const [showPost, setShowPost] = useState(false)
  const currency = getCurrency()
  const catMap = new Map(categories.map((c) => [c.id, c]))

  function load() {
    setLoadError(false)
    fetchRecurringItems()
      .then(setItems)
      .catch(() => setLoadError(true))
  }
  useEffect(load, [])

  return (
    <div className="space-y-3">
      <p className="text-[13px] font-medium text-ink-soft">固定收支模板（每月一键记入，免重复录入）</p>

      {loadError ? (
        <div className="flex items-center justify-between rounded-xl border border-seal/30 bg-seal/5 px-4 py-2.5 text-sm text-seal">
          模板加载失败
          <button onClick={load} className="font-semibold">重试</button>
        </div>
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-hairline px-4 py-3 text-center text-xs text-stone">
          还没有固定项，先新增房租、工资等每月固定的收支
        </p>
      ) : (
        <ul className="divide-y divide-hairline rounded-xl border border-hairline">
          {items.map((r) => {
            const cat = catMap.get(r.category_id ?? '')
            return (
              <li key={r.id}>
                <button
                  onClick={() => setEditing(r)}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left active:bg-hairline/50"
                >
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base"
                    style={{ backgroundColor: `${cat?.color ?? '#8A8A82'}1A` }}
                  >
                    {cat?.icon ?? '📝'}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{r.name}</span>
                    <span className="block text-xs text-stone">
                      每月 {r.day_of_month} 号 · {cat?.name ?? '未分类'}
                    </span>
                  </span>
                  <span
                    className={`num text-sm font-semibold ${r.type === 'income' ? 'text-income' : 'text-seal'}`}
                  >
                    {r.type === 'income' ? '+' : '−'}
                    {currency}
                    {fmtMoney(r.amount)}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => setEditing('new')}
          className="flex-1 rounded-xl border border-hairline bg-paper-raised py-2.5 text-sm font-medium active:bg-hairline"
        >
          + 新增固定项
        </button>
        <button
          onClick={() => setShowPost(true)}
          disabled={items.length === 0}
          className="flex-1 rounded-xl bg-ink py-2.5 text-sm font-semibold text-paper disabled:opacity-40"
        >
          记入固定收支
        </button>
      </div>

      {editing && (
        <RecurringEditor
          item={editing === 'new' ? null : editing}
          categories={categories}
          nextSortOrder={items.length}
          toast={toast}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            load()
          }}
        />
      )}
      {showPost && (
        <RecurringPostSheet
          items={items}
          catMap={catMap}
          toast={toast}
          onClose={() => setShowPost(false)}
          onPosted={() => {
            setShowPost(false)
            onDataChange?.()
          }}
        />
      )}
    </div>
  )
}

/** 新增/编辑固定项（嵌套弹层，盖在设置面板之上） */
function RecurringEditor({
  item,
  categories,
  nextSortOrder,
  toast,
  onClose,
  onSaved,
}: {
  item: RecurringItem | null
  categories: Category[]
  nextSortOrder: number
  toast: (msg: string) => void
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(item?.name ?? '')
  const [type, setType] = useState<TxType>(item?.type ?? 'expense')
  const [amount, setAmount] = useState(item ? String(item.amount) : '')
  const [categoryId, setCategoryId] = useState<string | null>(item?.category_id ?? null)
  const [day, setDay] = useState(item?.day_of_month ?? 1)
  const [note, setNote] = useState(item?.note ?? '')
  const [busy, setBusy] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const currency = getCurrency()

  async function save() {
    const value = parseFloat(amount)
    if (!name.trim()) return toast('先起个名字（如：房租）')
    if (!value || value <= 0) return toast('先输入金额')
    if (!categoryId) return toast('选一个分类')
    setBusy(true)
    try {
      const payload = {
        name: name.trim(),
        amount: value,
        type,
        category_id: categoryId,
        note: note.trim(),
        day_of_month: day,
        sort_order: item?.sort_order ?? nextSortOrder,
      }
      if (item) await updateRecurringItem(item.id, payload)
      else await insertRecurringItem(payload)
      toast(item ? '已保存修改' : '已添加固定项')
      onSaved()
    } catch (e) {
      toast(`保存失败：${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!item) return
    if (!confirmDel) {
      setConfirmDel(true)
      setTimeout(() => setConfirmDel(false), 2000)
      return
    }
    setBusy(true)
    try {
      await deleteRecurringItem(item.id)
      toast('已删除（历史账目不受影响）')
      onSaved()
    } catch (e) {
      toast(`删除失败：${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-paper p-5 pb-safe"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-hairline" />
        <h3 className="text-base font-bold">{item ? '编辑固定项' : '新增固定项'}</h3>

        <div className="mt-4 space-y-4">
          {/* 支出 / 收入 */}
          <div className="flex justify-center">
            <div className="flex rounded-full border border-hairline bg-paper-raised p-0.5">
              {(['expense', 'income'] as TxType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    setType(t)
                    setCategoryId(null)
                  }}
                  className={`rounded-full px-5 py-1.5 text-sm transition-colors ${
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
          </div>

          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="名称（如：房租、工资）"
            className="w-full rounded-xl border border-hairline bg-paper-raised px-4 py-3 text-[15px] outline-none focus:border-seal"
          />

          <div className="flex gap-2">
            <div className="flex flex-1 items-center gap-1 rounded-xl border border-hairline bg-paper-raised px-4">
              <span className="text-sm text-stone">{currency}</span>
              <input
                value={amount}
                onChange={(e) => {
                  const v = e.target.value
                  if (v === '' || AMOUNT_RE.test(v)) setAmount(v)
                }}
                inputMode="decimal"
                placeholder="金额"
                className="num w-full bg-transparent py-3 text-[15px] outline-none"
              />
            </div>
            <label className="flex items-center gap-1 rounded-xl border border-hairline bg-paper-raised px-3 text-sm text-ink-soft">
              每月
              <select
                value={day}
                onChange={(e) => setDay(Number(e.target.value))}
                className="num bg-transparent py-3 outline-none"
              >
                {DAYS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              号
            </label>
          </div>

          <CategoryGrid categories={categories} type={type} selected={categoryId} onSelect={setCategoryId} />

          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="备注（可选，默认用名称）"
            className="w-full rounded-xl border border-hairline bg-paper-raised px-4 py-3 text-[15px] outline-none focus:border-seal"
          />

          <button
            onClick={save}
            disabled={busy}
            className="w-full rounded-xl bg-ink py-3 text-sm font-semibold text-paper disabled:opacity-50"
          >
            {busy ? '保存中…' : '保存'}
          </button>
          {item && (
            <button
              onClick={remove}
              disabled={busy}
              className={`w-full rounded-xl border py-2.5 text-sm font-medium ${
                confirmDel ? 'border-seal bg-seal/5 font-semibold text-seal' : 'border-hairline text-seal'
              }`}
            >
              {confirmDel ? '再点一次确认删除' : '删除此固定项'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

interface PostRow {
  item: RecurringItem
  checked: boolean
  posted: boolean // 本月已记过
  amount: string
  date: string
}

/** 记入本月确认单：逐项可勾选/改金额/改日期，已记项跳过 */
function RecurringPostSheet({
  items,
  catMap,
  toast,
  onClose,
  onPosted,
}: {
  items: RecurringItem[]
  catMap: Map<string, Category>
  toast: (msg: string) => void
  onClose: () => void
  onPosted: () => void
}) {
  // 可切月：默认当前月，往回最多 BACKFILL_MONTHS 个月用于补记
  const [month, setMonth] = useState(monthKey())
  const [rows, setRows] = useState<PostRow[] | null>(null) // null = 查已记中
  const [busy, setBusy] = useState(false)
  const currency = getCurrency()
  const monthEnd = dayInMonth(month, 31)
  const minMonth = useMemo(() => {
    let m = monthKey()
    for (let i = 0; i < BACKFILL_MONTHS - 1; i++) m = prevMonth(m)
    return m
  }, [])

  useEffect(() => {
    let stale = false
    setRows(null) // 切月先回到「核对中」，避免上个月的勾选状态串到新月份
    fetchExistingHashes(items.map((i) => recurringHash(i.id, month)))
      .then((posted) => {
        if (stale) return
        setRows(
          items.map((item) => {
            const done = posted.has(recurringHash(item.id, month))
            return {
              item,
              posted: done,
              checked: !done,
              amount: String(item.amount),
              date: dayInMonth(month, item.day_of_month),
            }
          }),
        )
      })
      .catch((e) => {
        if (!stale) {
          toast(`加载失败：${(e as Error).message}`)
          onClose()
        }
      })
    return () => {
      stale = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month])

  function patchRow(i: number, patch: Partial<PostRow>) {
    setRows((rs) => rs && rs.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  }

  const selected = rows?.filter((r) => r.checked) ?? []

  async function confirm() {
    if (!rows) return
    for (const r of selected) {
      const v = parseFloat(r.amount)
      if (!v || v <= 0) return toast(`「${r.item.name}」金额不对`)
    }
    setBusy(true)
    try {
      await insertTransactions(
        selected.map((r) =>
          buildRecurringTx(r.item, month, getCurrency(), { amount: parseFloat(r.amount), date: r.date }),
        ),
      )
      toast(`已记入 ${fmtMonth(month)} ${selected.length} 笔`)
      onPosted()
    } catch (e) {
      const msg = (e as Error).message
      // 并发双击等极端情况被唯一索引挡下
      toast(msg.includes('duplicate') ? '该月已记过，未重复入账' : `记入失败：${msg}`)
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-paper p-5 pb-safe"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-hairline" />
        <h3 className="text-base font-bold">记入固定收支</h3>
        {/* 切月补记：往回最多 12 个月，不能超过当前月 */}
        <MonthSwitcher month={month} onChange={(m) => m >= minMonth && setMonth(m)} />

        {!rows ? (
          <p className="py-8 text-center text-sm text-stone">正在核对该月记录…</p>
        ) : (
          <>
            <ul className="mt-4 divide-y divide-hairline">
              {rows.map((r, i) => {
                const cat = catMap.get(r.item.category_id ?? '')
                return (
                  <li key={r.item.id} className={`flex items-center gap-3 py-3 ${r.posted ? 'opacity-50' : ''}`}>
                    {r.posted ? (
                      <span className="w-4 shrink-0 text-center text-xs text-stone">✓</span>
                    ) : (
                      <input
                        type="checkbox"
                        checked={r.checked}
                        onChange={(e) => patchRow(i, { checked: e.target.checked })}
                        className="h-4 w-4 shrink-0 accent-seal"
                      />
                    )}
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base"
                      style={{ backgroundColor: `${cat?.color ?? '#8A8A82'}1A` }}
                    >
                      {cat?.icon ?? '📝'}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{r.item.name}</span>
                      {r.posted ? (
                        <span className="block text-xs text-stone">该月已记</span>
                      ) : (
                        <input
                          type="date"
                          value={r.date}
                          min={`${month}-01`}
                          max={monthEnd}
                          onChange={(e) => e.target.value && patchRow(i, { date: e.target.value })}
                          className="num block bg-transparent text-xs text-stone outline-none"
                        />
                      )}
                    </span>
                    {r.posted ? (
                      <span className="num text-sm text-stone">
                        {currency}
                        {fmtMoney(r.item.amount)}
                      </span>
                    ) : (
                      <span
                        className={`flex items-center gap-0.5 text-sm font-semibold ${
                          r.item.type === 'income' ? 'text-income' : 'text-seal'
                        }`}
                      >
                        {r.item.type === 'income' ? '+' : '−'}
                        {currency}
                        <input
                          value={r.amount}
                          onChange={(e) => {
                            const v = e.target.value
                            if (v === '' || AMOUNT_RE.test(v)) patchRow(i, { amount: v })
                          }}
                          inputMode="decimal"
                          className="num w-20 rounded-lg border border-hairline bg-paper-raised px-2 py-1 text-right outline-none focus:border-seal"
                        />
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
            <button
              onClick={confirm}
              disabled={busy || selected.length === 0}
              className="mt-4 w-full rounded-xl bg-ink py-3 text-sm font-semibold text-paper disabled:opacity-40"
            >
              {busy
                ? '记入中…'
                : selected.length === 0
                  ? '没有可记入的项'
                  : `确认记入 ${fmtMonth(month)} · ${selected.length} 笔`}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
