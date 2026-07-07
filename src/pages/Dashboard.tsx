import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { Category, Transaction } from '../lib/types'
import { fetchTransactions } from '../lib/db'
import { isConfigured } from '../lib/supabase'
import { CURRENCY, fmtMoney, fmtMonth, monthKey, prevMonth } from '../lib/format'
import MonthSwitcher from '../components/MonthSwitcher'
import Settings from '../components/Settings'

interface Props {
  categories: Category[]
  toast: (msg: string) => void
}

const OTHER_COLOR = '#8A8A82'

export default function Dashboard({ categories, toast }: Props) {
  const [month, setMonth] = useState(monthKey())
  const [txs, setTxs] = useState<Transaction[]>([])
  const [prevTxs, setPrevTxs] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])

  useEffect(() => {
    setLoading(true)
    Promise.all([fetchTransactions(month), fetchTransactions(prevMonth(month))])
      .then(([cur, prev]) => {
        setTxs(cur)
        setPrevTxs(prev)
      })
      .finally(() => setLoading(false))
  }, [month])

  const expenses = txs.filter((t) => t.type === 'expense')
  const totalExpense = expenses.reduce((s, t) => s + t.amount, 0)
  const totalIncome = txs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const prevExpense = prevTxs
    .filter((t) => t.type === 'expense')
    .reduce((s, t) => s + t.amount, 0)
  const momPct = prevExpense > 0 ? ((totalExpense - prevExpense) / prevExpense) * 100 : null

  // 分类汇总，按金额降序
  const byCategory = useMemo(() => {
    const sums = new Map<string, number>()
    for (const t of expenses) {
      const key = t.category_id ?? 'uncat'
      sums.set(key, (sums.get(key) ?? 0) + t.amount)
    }
    return Array.from(sums.entries())
      .map(([id, value]) => {
        const cat = catMap.get(id)
        return {
          id,
          name: cat?.name ?? '未分类',
          icon: cat?.icon ?? '❓',
          color: cat?.color ?? OTHER_COLOR,
          value,
        }
      })
      .sort((a, b) => b.value - a.value)
  }, [expenses, catMap])

  // 每日支出
  const daily = useMemo(() => {
    const [y, m] = month.split('-').map(Number)
    const days = new Date(y, m, 0).getDate()
    const arr = Array.from({ length: days }, (_, i) => ({ day: i + 1, value: 0 }))
    for (const t of expenses) {
      const d = Number(t.date.slice(8, 10))
      arr[d - 1].value += t.amount
    }
    return arr
  }, [expenses, month])

  return (
    <div className="px-4 pt-safe">
      <div className="relative pt-3">
        <MonthSwitcher month={month} onChange={setMonth} />
        {isConfigured && (
          <button
            onClick={() => setShowSettings(true)}
            aria-label="设置"
            className="absolute right-0 top-1/2 mt-1.5 -translate-y-1/2 p-2 text-stone active:text-ink"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.11-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.56-1.11 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.08a1.7 1.7 0 0 0 1.03-1.56V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.08a1.7 1.7 0 0 0 1.56 1.03H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1.03Z" />
            </svg>
          </button>
        )}
      </div>
      {showSettings && <Settings onClose={() => setShowSettings(false)} toast={toast} />}

      {loading ? (
        <p className="py-16 text-center text-sm text-stone">加载中…</p>
      ) : txs.length === 0 ? (
        <div className="py-20 text-center">
          <p className="text-4xl">🧮</p>
          <p className="mt-3 text-sm text-stone">{fmtMonth(month)}没有账目</p>
        </div>
      ) : (
        <div className="space-y-6 pb-6 pt-2">
          {/* 月度汇总 */}
          <section className="rounded-2xl border border-hairline bg-paper-raised p-5">
            <p className="text-xs tracking-widest text-stone">本月支出</p>
            <p className="num mt-1 text-4xl font-bold">
              <span className="mr-1 text-xl font-medium text-stone">{CURRENCY}</span>
              {fmtMoney(totalExpense)}
            </p>
            <div className="mt-3 flex items-center gap-4 text-[13px] text-ink-soft">
              <span>
                收入 <span className="num">{CURRENCY}{fmtMoney(totalIncome)}</span>
              </span>
              <span>
                结余{' '}
                <span className={`num ${totalIncome - totalExpense >= 0 ? 'text-income' : 'text-seal'}`}>
                  {CURRENCY}{fmtMoney(totalIncome - totalExpense)}
                </span>
              </span>
              {momPct !== null && (
                <span className="ml-auto text-stone">
                  比上月 {momPct >= 0 ? '↑' : '↓'} {Math.abs(momPct).toFixed(0)}%
                </span>
              )}
            </div>
          </section>

          {/* 分类占比 */}
          {byCategory.length > 0 && (
            <section>
              <h2 className="mb-1 text-sm font-semibold text-ink-soft">支出构成</h2>
              <div className="h-52">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={byCategory}
                      dataKey="value"
                      nameKey="name"
                      innerRadius="62%"
                      outerRadius="95%"
                      stroke="#FAFAF7"
                      strokeWidth={2}
                      isAnimationActive={false}
                    >
                      {byCategory.map((c) => (
                        <Cell key={c.id} fill={c.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v) => `${CURRENCY}${fmtMoney(Number(v))}`}
                      contentStyle={tooltipStyle}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              {/* 分类排行：兼作图例与数据表 */}
              <ul className="mt-2 space-y-2.5">
                {byCategory.map((c) => {
                  const pct = totalExpense > 0 ? (c.value / totalExpense) * 100 : 0
                  return (
                    <li key={c.id} className="flex items-center gap-2.5">
                      <span className="text-base">{c.icon}</span>
                      <span className="w-16 shrink-0 text-[13px]">{c.name}</span>
                      <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-hairline/60">
                        <span
                          className="absolute inset-y-0 left-0 rounded-full"
                          style={{ width: `${pct}%`, backgroundColor: c.color }}
                        />
                      </span>
                      <span className="num w-10 shrink-0 text-right text-xs text-stone">
                        {pct.toFixed(0)}%
                      </span>
                      <span className="num w-20 shrink-0 text-right text-[13px] font-medium">
                        {fmtMoney(c.value)}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}

          {/* 每日支出 */}
          <section>
            <h2 className="mb-2 text-sm font-semibold text-ink-soft">每日支出</h2>
            <div className="h-40">
              <ResponsiveContainer>
                <BarChart data={daily} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                  <XAxis
                    dataKey="day"
                    tickLine={false}
                    axisLine={{ stroke: '#E8E6DF' }}
                    tick={{ fontSize: 10, fill: '#8A8A82' }}
                    ticks={[1, 5, 10, 15, 20, 25, daily.length]}
                  />
                  <YAxis hide />
                  <Tooltip
                    cursor={{ fill: '#E8E6DF', opacity: 0.4 }}
                    formatter={(v) => [`${CURRENCY}${fmtMoney(Number(v))}`, '支出']}
                    labelFormatter={(d) => `${Number(month.slice(5))}月${d}日`}
                    contentStyle={tooltipStyle}
                  />
                  <Bar
                    dataKey="value"
                    fill="#C0392B"
                    radius={[4, 4, 0, 0]}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

const tooltipStyle: React.CSSProperties = {
  background: '#FFFFFF',
  border: '1px solid #E8E6DF',
  borderRadius: 10,
  fontSize: 12,
  color: '#1A1A18',
}
