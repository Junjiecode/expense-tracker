import { useEffect, useMemo, useRef, useState } from 'react'
import Papa from 'papaparse'
import type { Category, CategoryRule } from '../lib/types'
import { fetchExistingHashes, fetchRules, insertTransactions, matchRule, saveRule } from '../lib/db'
import { fmtMoney, getCurrency, sha256 } from '../lib/format'
import { guessColumns, parseAmount, parseDate, type DateFormat } from '../lib/csv'

interface Props {
  categories: Category[]
  toast: (msg: string) => void
}

interface Mapping {
  date: number
  amount: number
  desc: number
  dateFormat: DateFormat
  negativeIsExpense: boolean
  hasHeader: boolean
}

interface PreviewRow {
  key: number
  date: string
  description: string
  amount: number // 正数
  type: 'expense' | 'income'
  categoryId: string | null
  hash: string
  duplicate: boolean
  included: boolean
}

type Step =
  | { name: 'pick' }
  | { name: 'map'; rows: string[][]; mapping: Mapping }
  | { name: 'preview'; rows: PreviewRow[]; badCount: number }

const MAPPING_STORE = 'csv-mappings' // headerSignature -> Mapping

export default function Import({ categories, toast }: Props) {
  const [step, setStep] = useState<Step>({ name: 'pick' })
  const [rules, setRules] = useState<CategoryRule[]>([])
  const [busy, setBusy] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])

  useEffect(() => {
    fetchRules().then(setRules).catch(() => {})
  }, [])

  function headerSignature(rows: string[][]): string {
    return rows[0]?.join('|') ?? ''
  }

  function pickFile(file: File) {
    Papa.parse<string[]>(file, {
      skipEmptyLines: true,
      complete: (res) => {
        const rows = res.data.filter((r) => r.length > 1)
        if (rows.length === 0) return toast('没有解析到数据行')
        const saved = JSON.parse(localStorage.getItem(MAPPING_STORE) ?? '{}')[
          headerSignature(rows)
        ] as Mapping | undefined
        const mapping: Mapping =
          saved ?? {
            ...guessColumns(rows.slice(1)),
            dateFormat: 'auto',
            negativeIsExpense: true,
            hasHeader: true,
          }
        setStep({ name: 'map', rows, mapping })
      },
      error: () => toast('文件解析失败'),
    })
  }

  async function buildPreview(rows: string[][], mapping: Mapping) {
    setBusy(true)
    try {
      const dataRows = mapping.hasHeader ? rows.slice(1) : rows
      const parsed: Omit<PreviewRow, 'hash' | 'duplicate' | 'included' | 'key'>[] = []
      let badCount = 0
      for (const r of dataRows) {
        const date = parseDate(r[mapping.date] ?? '', mapping.dateFormat)
        const rawAmount = parseAmount(r[mapping.amount] ?? '')
        if (!date || rawAmount === null || rawAmount === 0) {
          badCount++
          continue
        }
        const isExpense = mapping.negativeIsExpense ? rawAmount < 0 : rawAmount > 0
        const description = (r[mapping.desc] ?? '').trim()
        parsed.push({
          date,
          description,
          amount: Math.abs(rawAmount),
          type: isExpense ? 'expense' : 'income',
          categoryId: matchRule(description, rules),
        })
      }
      if (parsed.length === 0) {
        toast('一条有效记录都没有，检查列映射是否正确')
        return
      }
      // 哈希去重：同文件内重复行加序号，保证幂等
      const seen = new Map<string, number>()
      const withHash: PreviewRow[] = []
      for (let i = 0; i < parsed.length; i++) {
        const p = parsed[i]
        const base = `${p.date}|${p.amount.toFixed(2)}|${p.type}|${p.description}`
        const n = seen.get(base) ?? 0
        seen.set(base, n + 1)
        const hash = await sha256(n === 0 ? base : `${base}|${n}`)
        withHash.push({ ...p, key: i, hash, duplicate: false, included: true })
      }
      const existing = await fetchExistingHashes(withHash.map((r) => r.hash))
      for (const r of withHash) {
        if (existing.has(r.hash)) {
          r.duplicate = true
          r.included = false
        }
      }
      // 记住这份映射
      const store = JSON.parse(localStorage.getItem(MAPPING_STORE) ?? '{}')
      store[headerSignature(rows)] = mapping
      localStorage.setItem(MAPPING_STORE, JSON.stringify(store))

      setStep({ name: 'preview', rows: withHash, badCount })
    } catch (e) {
      toast(`处理失败：${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  async function confirmImport(rows: PreviewRow[]) {
    const toInsert = rows.filter((r) => r.included)
    if (toInsert.length === 0) return toast('没有选中任何记录')
    setBusy(true)
    try {
      for (let i = 0; i < toInsert.length; i += 200) {
        await insertTransactions(
          toInsert.slice(i, i + 200).map((r) => ({
            date: r.date,
            amount: r.amount,
            type: r.type,
            description: r.description,
            category_id: r.categoryId,
            note: '',
            source: 'csv' as const,
            import_hash: r.hash,
          })),
        )
      }
      // 把本次手动指定的分类沉淀为规则，下次自动分类
      const newRules: CategoryRule[] = []
      for (const r of toInsert) {
        if (!r.categoryId || !r.description) continue
        if (matchRule(r.description, [...rules, ...newRules])) continue
        try {
          await saveRule(r.description, r.categoryId)
          newRules.push({ id: '', user_id: '', keyword: r.description, category_id: r.categoryId })
        } catch {
          // 规则保存失败不影响导入
        }
      }
      if (newRules.length > 0) setRules(await fetchRules())
      toast(`已导入 ${toInsert.length} 条`)
      setStep({ name: 'pick' })
    } catch (e) {
      toast(`导入失败：${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  /* ---------- 渲染 ---------- */

  if (step.name === 'pick') {
    return (
      <div className="flex min-h-[60dvh] flex-col items-center justify-center px-8 pt-safe">
        <p className="text-4xl">🧾</p>
        <h1 className="mt-4 text-lg font-bold">导入银行账单</h1>
        <p className="mt-2 text-center text-sm text-ink-soft">
          从银行或信用卡官网下载 CSV 对账单，在这里导入。重复导入同一份文件不会产生重复账目。
        </p>
        <button
          onClick={() => fileInput.current?.click()}
          className="mt-6 rounded-xl bg-seal px-8 py-3.5 font-semibold text-white active:bg-seal-deep"
        >
          选择 CSV 文件
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) pickFile(f)
            e.target.value = ''
          }}
        />
      </div>
    )
  }

  if (step.name === 'map') {
    const { rows, mapping } = step
    const headers = mapping.hasHeader
      ? rows[0]
      : rows[0].map((_, i) => `第 ${i + 1} 列`)
    const sampleRow = rows[mapping.hasHeader ? 1 : 0] ?? []
    const set = (patch: Partial<Mapping>) =>
      setStep({ name: 'map', rows, mapping: { ...mapping, ...patch } })

    return (
      <div className="px-4 pt-safe">
        <h1 className="pt-4 text-lg font-bold">对应列映射</h1>
        <p className="mt-1 text-sm text-stone">告诉我每个字段在账单的哪一列（已自动猜测）</p>

        <div className="mt-5 space-y-4">
          {(
            [
              ['date', '日期列'],
              ['amount', '金额列'],
              ['desc', '描述/商家列'],
            ] as const
          ).map(([field, label]) => (
            <label key={field} className="block">
              <span className="text-[13px] font-medium text-ink-soft">{label}</span>
              <select
                value={mapping[field]}
                onChange={(e) => set({ [field]: Number(e.target.value) } as Partial<Mapping>)}
                className="mt-1 w-full rounded-lg border border-hairline bg-paper-raised px-3 py-2.5 text-sm"
              >
                {headers.map((h, i) => (
                  <option key={i} value={i}>
                    {h || `第 ${i + 1} 列`}（如：{sampleRow[i]?.slice(0, 24) || '空'}）
                  </option>
                ))}
              </select>
            </label>
          ))}

          <label className="block">
            <span className="text-[13px] font-medium text-ink-soft">金额方向</span>
            <select
              value={mapping.negativeIsExpense ? 'neg' : 'pos'}
              onChange={(e) => set({ negativeIsExpense: e.target.value === 'neg' })}
              className="mt-1 w-full rounded-lg border border-hairline bg-paper-raised px-3 py-2.5 text-sm"
            >
              <option value="neg">负数是支出（多数银行账户）</option>
              <option value="pos">正数是支出（多数信用卡账单）</option>
            </select>
          </label>

          <label className="block">
            <span className="text-[13px] font-medium text-ink-soft">日期格式</span>
            <select
              value={mapping.dateFormat}
              onChange={(e) => set({ dateFormat: e.target.value as DateFormat })}
              className="mt-1 w-full rounded-lg border border-hairline bg-paper-raised px-3 py-2.5 text-sm"
            >
              <option value="auto">自动识别</option>
              <option value="ymd">年-月-日</option>
              <option value="mdy">月/日/年</option>
              <option value="dmy">日/月/年</option>
            </select>
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={mapping.hasHeader}
              onChange={(e) => set({ hasHeader: e.target.checked })}
              className="h-4 w-4 accent-seal"
            />
            首行是标题行
          </label>
        </div>

        <div className="mt-6 flex gap-3 pb-6">
          <button
            onClick={() => setStep({ name: 'pick' })}
            className="rounded-xl border border-hairline px-5 py-3 text-sm font-medium text-ink-soft"
          >
            返回
          </button>
          <button
            onClick={() => buildPreview(rows, mapping)}
            disabled={busy}
            className="flex-1 rounded-xl bg-ink py-3 text-sm font-semibold text-paper disabled:opacity-50"
          >
            {busy ? '处理中…' : `预览（共 ${rows.length - (mapping.hasHeader ? 1 : 0)} 行）`}
          </button>
        </div>
      </div>
    )
  }

  // preview
  const { rows, badCount } = step
  const included = rows.filter((r) => r.included)
  const dupCount = rows.filter((r) => r.duplicate).length
  const updateRow = (key: number, patch: Partial<PreviewRow>) =>
    setStep({
      name: 'preview',
      rows: rows.map((r) => (r.key === key ? { ...r, ...patch } : r)),
      badCount,
    })

  return (
    <div className="px-4 pt-safe">
      <div className="sticky top-0 z-10 -mx-4 bg-paper/95 px-4 pt-4 pb-2 backdrop-blur">
        <h1 className="text-lg font-bold">确认导入</h1>
        <p className="mt-0.5 text-xs text-stone">
          将导入 {included.length} 条
          {dupCount > 0 && ` · ${dupCount} 条已存在（自动跳过）`}
          {badCount > 0 && ` · ${badCount} 行无法解析`}
        </p>
      </div>

      <ul className="divide-y divide-hairline pb-32">
        {rows.map((r) => {
          const cat = r.categoryId ? catMap.get(r.categoryId) : undefined
          return (
            <li
              key={r.key}
              className={`flex items-center gap-3 py-3 ${r.included ? '' : 'opacity-40'}`}
            >
              <input
                type="checkbox"
                checked={r.included}
                disabled={r.duplicate}
                onChange={(e) => updateRow(r.key, { included: e.target.checked })}
                className="h-4 w-4 shrink-0 accent-seal"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{r.description || '（无描述）'}</p>
                <p className="mt-0.5 flex items-center gap-2 text-xs text-stone">
                  <span className="num">{r.date}</span>
                  {r.duplicate && (
                    <span className="rounded bg-hairline px-1.5 py-0.5 text-[10px]">已存在</span>
                  )}
                </p>
              </div>
              <select
                value={r.categoryId ?? ''}
                onChange={(e) => updateRow(r.key, { categoryId: e.target.value || null })}
                className="w-24 shrink-0 rounded-lg border border-hairline bg-paper-raised px-2 py-1.5 text-xs"
                style={{ color: cat?.color }}
              >
                <option value="">未分类</option>
                {categories
                  .filter((c) => c.type === r.type)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.icon} {c.name}
                    </option>
                  ))}
              </select>
              <span
                className={`num w-20 shrink-0 text-right text-sm font-semibold ${
                  r.type === 'income' ? 'text-income' : ''
                }`}
              >
                {r.type === 'income' ? '+' : '−'}
                {fmtMoney(r.amount)}
              </span>
            </li>
          )
        })}
      </ul>

      <div className="fixed inset-x-0 bottom-20 z-10 mx-auto flex max-w-lg gap-3 px-4">
        <button
          onClick={() => setStep({ name: 'pick' })}
          className="rounded-xl border border-hairline bg-paper px-5 py-3 text-sm font-medium text-ink-soft"
        >
          取消
        </button>
        <button
          onClick={() => confirmImport(rows)}
          disabled={busy || included.length === 0}
          className="flex-1 rounded-xl bg-seal py-3 text-sm font-semibold text-white shadow-sm active:bg-seal-deep disabled:opacity-50"
        >
          {busy
            ? '导入中…'
            : `导入 ${included.length} 条 · ${getCurrency()}${fmtMoney(
                included.filter((r) => r.type === 'expense').reduce((s, r) => s + r.amount, 0),
              )}`}
        </button>
      </div>
    </div>
  )
}
