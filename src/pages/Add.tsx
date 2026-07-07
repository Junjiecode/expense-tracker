import { useRef, useState } from 'react'
import type { Category, TxType } from '../lib/types'
import { insertTransaction } from '../lib/db'
import { fmtDateLabel, fmtMoney, getCurrency, todayStr } from '../lib/format'
import CategoryGrid from '../components/CategoryGrid'

interface Props {
  categories: Category[]
  toast: (msg: string) => void
}

export default function Add({ categories, toast }: Props) {
  const [type, setType] = useState<TxType>('expense')
  const [amount, setAmount] = useState('') // 字符串态，直接对接键盘输入
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [date, setDate] = useState(todayStr())
  const [note, setNote] = useState('')
  const [stamping, setStamping] = useState(false)
  const [saving, setSaving] = useState(false)
  const dateInput = useRef<HTMLInputElement>(null)
  const currency = getCurrency()

  function press(key: string) {
    setAmount((cur) => {
      if (key === 'del') return cur.slice(0, -1)
      if (key === '.') {
        if (cur.includes('.')) return cur
        return cur === '' ? '0.' : cur + '.'
      }
      const next = cur + key
      // 最多两位小数、整数部分最多 8 位
      const [int, dec] = next.split('.')
      if (dec !== undefined && dec.length > 2) return cur
      if (int.length > 8) return cur
      if (next === '00') return '0'
      return next
    })
  }

  async function save() {
    const value = parseFloat(amount)
    if (!value || value <= 0) return toast('先输入金额')
    if (!categoryId) return toast('选一个分类')
    setStamping(true)
    setTimeout(() => setStamping(false), 300)
    navigator.vibrate?.(15)
    setSaving(true)
    try {
      await insertTransaction({
        date,
        amount: value,
        type,
        description: '',
        category_id: categoryId,
        note: note.trim(),
        source: 'manual',
        import_hash: null,
      })
      toast(`已入账 ${currency}${fmtMoney(value)}`)
      setAmount('')
      setNote('')
      setDate(todayStr())
    } catch (e) {
      toast(`保存失败：${(e as Error).message}`)
    } finally {
      setSaving(false)
    }
  }

  const displayAmount = amount === '' ? '0.00' : amount

  return (
    <div className="flex min-h-[calc(100dvh-6rem)] flex-col px-4 pt-safe">
      {/* 支出 / 收入切换 */}
      <div className="flex justify-center pt-4">
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

      {/* 日期 + 金额 */}
      <div className="flex items-center justify-between gap-3 border-b border-hairline px-2 py-6">
        <button
          onClick={() => {
            const el = dateInput.current
            if (!el) return
            if (typeof el.showPicker === 'function') el.showPicker()
            else el.click()
          }}
          className="relative flex shrink-0 items-center gap-1.5 rounded-full border border-hairline bg-paper-raised px-3.5 py-2 text-sm text-ink-soft active:bg-hairline"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="4" y="6" width="16" height="14" rx="2" />
            <path d="M4 10h16M8 4v4M16 4v4" strokeLinecap="round" />
          </svg>
          {fmtDateLabel(date)}
          <svg viewBox="0 0 24 24" className="h-3 w-3 text-stone" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <input
            ref={dateInput}
            type="date"
            value={date}
            max={todayStr()}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="absolute inset-0 opacity-0"
            tabIndex={-1}
          />
        </button>
        <div className="flex min-w-0 items-baseline gap-1">
          <span className="text-2xl text-stone">{currency}</span>
          <span className={`num truncate text-5xl font-bold ${amount === '' ? 'text-hairline' : ''}`}>
            {displayAmount}
          </span>
        </div>
      </div>

      {/* 分类 */}
      <div className="flex-1 overflow-y-auto py-5">
        <CategoryGrid
          categories={categories}
          type={type}
          selected={categoryId}
          onSelect={setCategoryId}
        />
      </div>

      {/* 备注 */}
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="备注（可选）"
        className="mb-3 w-full rounded-lg border border-hairline bg-paper-raised px-3 py-2.5 text-sm outline-none focus:border-seal"
      />

      {/* 键盘 */}
      <div className="grid grid-cols-4 grid-rows-4 gap-2 pb-2">
        {['1', '2', '3'].map((k) => (
          <Key key={k} label={k} onPress={() => press(k)} />
        ))}
        <button
          onClick={() => press('del')}
          className="num row-span-2 rounded-xl border border-hairline bg-paper-raised text-xl text-ink-soft active:bg-hairline"
        >
          ⌫
        </button>
        {['4', '5', '6'].map((k) => (
          <Key key={k} label={k} onPress={() => press(k)} />
        ))}
        {['7', '8', '9'].map((k) => (
          <Key key={k} label={k} onPress={() => press(k)} />
        ))}
        {/* 印章保存键：盖章即入账 */}
        <button
          onClick={save}
          disabled={saving}
          className={`row-span-2 rounded-xl text-2xl font-bold text-white shadow-sm disabled:opacity-60 ${
            type === 'expense' ? 'bg-seal active:bg-seal-deep' : 'bg-income'
          } ${stamping ? 'stamping' : ''}`}
        >
          记
        </button>
        <Key label="." onPress={() => press('.')} />
        <Key label="0" onPress={() => press('0')} />
        <Key label="00" onPress={() => { press('0'); press('0') }} />
      </div>
    </div>
  )
}

function Key({ label, onPress, muted }: { label: string; onPress: () => void; muted?: boolean }) {
  return (
    <button
      onClick={onPress}
      className={`num rounded-xl border border-hairline bg-paper-raised py-3.5 text-xl font-medium active:bg-hairline ${
        muted ? 'text-ink-soft' : ''
      }`}
    >
      {label}
    </button>
  )
}
