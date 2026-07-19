import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { Category, Transaction } from '../lib/types'
import { fetchTransactionsRange } from '../lib/db'
import {
  WEEKDAYS,
  convert,
  fmtMoney,
  fmtMonth,
  getCurrency,
  getRate,
  monthKey,
  prevMonth,
  todayStr,
} from '../lib/format'
import MonthSwitcher from '../components/MonthSwitcher'
import Settings from '../components/Settings'
import { useChartTheme } from '../components/charts/chartTheme'
import type { ChartColors } from '../components/charts/chartTheme'
import CumulativeChart from '../components/charts/CumulativeChart'
import BalanceLine from '../components/charts/BalanceLine'
import CategoryTrendChart from '../components/charts/CategoryTrendChart'

interface Props {
  categories: Category[]
  toast: (msg: string) => void
  /** 设置面板里分类增删改后通知 App 重新拉取分类 */
  onCategoriesChange?: () => void
}

/** 「其他/未分类」的中性灰，浅深两主题通用 */
const STONE = '#8A8A82'

/** 趋势窗口：选中月及往前共 6 个月 */
const TREND_MONTHS = 6
/** 饼图最多分片数，超出的小类合并为「其他」 */
const MAX_PIE_SLICES = 6

function monthsAgo(month: string, n: number): string {
  let m = month
  for (let i = 0; i < n; i++) m = prevMonth(m)
  return m
}

export default function Dashboard({ categories, toast, onCategoriesChange }: Props) {
  const [month, setMonth] = useState(monthKey())
  const [rangeTxs, setRangeTxs] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)
  const [showSettings, setShowSettings] = useState(false)
  const [currency, setCurrencyView] = useState(getCurrency())
  const [rate, setRateView] = useState(getRate())
  const { C, catColor, tooltipStyle } = useChartTheme()
  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])

  useEffect(() => {
    let stale = false // 快速切月时丢弃过期响应
    setLoading(true)
    setError(null)
    fetchTransactionsRange(monthsAgo(month, TREND_MONTHS - 1), month)
      .then((d) => {
        if (!stale) setRangeTxs(d)
      })
      .catch((e) => {
        if (!stale) setError((e as Error).message)
      })
      .finally(() => {
        if (!stale) setLoading(false)
      })
    return () => {
      stale = true
    }
  }, [month, reload])

  // 统一折算成显示币种，下游聚合与图表全部消费已折算数据
  const convTxs = useMemo(
    () =>
      rangeTxs.map((t) =>
        t.currency === currency
          ? t
          : { ...t, amount: convert(t.amount, t.currency, currency, rate), currency },
      ),
    [rangeTxs, currency, rate],
  )

  const txs = useMemo(() => convTxs.filter((t) => t.date.startsWith(month)), [convTxs, month])
  const expenses = useMemo(() => txs.filter((t) => t.type === 'expense'), [txs])
  const totalExpense = expenses.reduce((s, t) => s + t.amount, 0)
  const totalIncome = txs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const prevExpense = useMemo(() => {
    const pm = prevMonth(month)
    return convTxs
      .filter((t) => t.date.startsWith(pm) && t.type === 'expense')
      .reduce((s, t) => s + t.amount, 0)
  }, [convTxs, month])
  const momPct = prevExpense > 0 ? ((totalExpense - prevExpense) / prevExpense) * 100 : null
  const balance = totalIncome - totalExpense

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
          color: cat?.color ?? STONE,
          value,
        }
      })
      .sort((a, b) => b.value - a.value)
  }, [expenses, catMap])

  // 饼图数据：小类折叠成「其他」，下方排行仍显示完整明细
  const pieData = useMemo(() => {
    if (byCategory.length <= MAX_PIE_SLICES) return byCategory
    const top = byCategory.slice(0, MAX_PIE_SLICES - 1)
    const rest = byCategory.slice(MAX_PIE_SLICES - 1).reduce((s, c) => s + c.value, 0)
    return [...top, { id: 'fold', name: '其他', icon: '', color: STONE, value: rest }]
  }, [byCategory])

  // 每日支出（附当日分类明细，tooltip 用）
  const daily = useMemo(() => {
    const [y, m] = month.split('-').map(Number)
    const days = new Date(y, m, 0).getDate()
    const sums = Array.from({ length: days }, () => new Map<string, number>())
    for (const t of expenses) {
      const byCat = sums[Number(t.date.slice(8, 10)) - 1]
      const key = t.category_id ?? 'uncat'
      byCat.set(key, (byCat.get(key) ?? 0) + t.amount)
    }
    return sums.map((byCat, i) => ({
      day: i + 1,
      value: [...byCat.values()].reduce((s, v) => s + v, 0),
      breakdown: [...byCat.entries()]
        .map(([id, amount]) => {
          const cat = catMap.get(id)
          return { id, icon: cat?.icon ?? '❓', name: cat?.name ?? '未分类', amount }
        })
        .sort((a, b) => b.amount - a.amount),
    }))
  }, [expenses, month, catMap])

  // 日均支出：当前月按已过天数，历史月按整月天数
  const elapsedDays = month === monthKey() ? Number(todayStr().slice(8, 10)) : daily.length
  const dailyAvg = elapsedDays > 0 ? totalExpense / elapsedDays : 0

  // 近半年逐月收支（窗口锚定选中月，选中月在最右）
  const trend = useMemo(() => {
    const months = Array.from({ length: TREND_MONTHS }, (_, i) =>
      monthsAgo(month, TREND_MONTHS - 1 - i),
    )
    const sums = new Map(months.map((m) => [m, { expense: 0, income: 0 }]))
    for (const t of convTxs) {
      const s = sums.get(t.date.slice(0, 7))
      if (s) s[t.type] += t.amount
    }
    return months.map((m) => ({
      month: m,
      label: `${Number(m.slice(5))}月`,
      ...sums.get(m)!,
    }))
  }, [convTxs, month])

  function jumpToTrendMonth(index: number) {
    const m = trend[index]?.month
    if (m && m !== month) setMonth(m)
  }

  return (
    <div className="px-4 pt-safe">
      <div className="relative pt-3">
        <MonthSwitcher month={month} onChange={setMonth} />
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
      </div>
      {showSettings && (
        <Settings
          onClose={() => setShowSettings(false)}
          toast={toast}
          categories={categories}
          onCurrencyChange={setCurrencyView}
          onRateChange={setRateView}
          onDataChange={() => setReload((n) => n + 1)}
          onCategoriesChange={onCategoriesChange}
        />
      )}

      {loading ? (
        <p className="py-16 text-center text-sm text-stone">加载中…</p>
      ) : error ? (
        <div className="py-20 text-center">
          <p className="text-4xl">📡</p>
          <p className="mt-3 text-sm text-stone">加载失败：{error}</p>
          <button
            onClick={() => setReload((n) => n + 1)}
            className="mt-4 rounded-xl border border-hairline bg-paper-raised px-5 py-2 text-sm font-medium active:bg-hairline/40"
          >
            重试
          </button>
        </div>
      ) : txs.length === 0 ? (
        <div className="py-20 text-center">
          <p className="text-4xl">🧮</p>
          <p className="mt-3 text-sm text-stone">{fmtMonth(month)}没有账目</p>
        </div>
      ) : (
        <div className="space-y-6 pb-6 pt-2">
          {/* 月度汇总：结余做主角 */}
          <section className="rounded-2xl border border-hairline bg-paper-raised p-5">
            <div className="flex items-baseline justify-between">
              <p className="text-xs tracking-widest text-stone">
                {Number(month.slice(5))}月结余
              </p>
              {momPct !== null && (
                <span className="text-xs text-stone">
                  支出比上月 {momPct >= 0 ? '↑' : '↓'} {Math.abs(momPct).toFixed(0)}%
                </span>
              )}
            </div>
            <div className="mt-1 flex items-center gap-2.5">
              <p className={`num text-4xl font-bold ${balance >= 0 ? 'text-income' : 'text-seal'}`}>
                {balance >= 0 ? '+' : '−'}
                <span className="text-xl font-medium">{currency}</span>
                {fmtMoney(Math.abs(balance))}
              </p>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  balance >= 0 ? 'bg-income/10 text-income' : 'bg-seal/10 text-seal'
                }`}
              >
                {balance >= 0 ? '盈余' : '赤字'}
              </span>
            </div>
            <div className="mt-4 flex gap-8 border-t border-hairline pt-3">
              <div>
                <p className="text-xs text-stone">支出</p>
                <p className="num mt-0.5 text-lg font-semibold">
                  {currency}{fmtMoney(totalExpense)}
                </p>
              </div>
              <div>
                <p className="text-xs text-stone">收入</p>
                <p className="num mt-0.5 text-lg font-semibold text-income">
                  {currency}{fmtMoney(totalIncome)}
                </p>
              </div>
            </div>
          </section>

          {/* 支出节奏：逐日累计 vs 上月同期 */}
          <CumulativeChart rangeTxs={convTxs} month={month} currency={currency} />

          {/* 分类占比 */}
          {byCategory.length > 0 && (
            <section>
              <h2 className="mb-1 text-sm font-semibold text-ink-soft">支出构成</h2>
              <div className="relative h-52">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius="62%"
                      outerRadius="95%"
                      stroke={C.paper}
                      strokeWidth={2}
                      isAnimationActive={false}
                    >
                      {pieData.map((c) => (
                        <Cell key={c.id} fill={catColor(c.color)} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v) => {
                        const n = Number(v)
                        const pct = totalExpense > 0 ? Math.round((n / totalExpense) * 100) : 0
                        return `${currency}${fmtMoney(n)} · ${pct}%`
                      }}
                      contentStyle={tooltipStyle}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* 环形中心：本月总支出 */}
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <p className="text-xs text-stone">支出</p>
                  <p className="num text-lg font-semibold">
                    {currency}{fmtMoney(totalExpense)}
                  </p>
                </div>
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
                          style={{ width: `${pct}%`, backgroundColor: catColor(c.color) }}
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
                    axisLine={{ stroke: C.hairline }}
                    tick={{ fontSize: 10, fill: C.stone }}
                    ticks={[1, 5, 10, 15, 20, 25, daily.length]}
                  />
                  <YAxis hide />
                  <Tooltip
                    cursor={{ fill: C.hairline, opacity: 0.4 }}
                    content={
                      <DailyTooltip month={month} currency={currency} c={C} tooltipStyle={tooltipStyle} />
                    }
                  />
                  {dailyAvg > 0 && (
                    <ReferenceLine
                      y={dailyAvg}
                      stroke={C.stone}
                      strokeDasharray="4 3"
                      label={{ value: '日均', fontSize: 10, fill: C.stone, position: 'insideTopRight' }}
                    />
                  )}
                  <Bar
                    dataKey="value"
                    fill={C.seal}
                    radius={[4, 4, 0, 0]}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* 近半年收支趋势 */}
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink-soft">近半年收支</h2>
              <div className="flex items-center gap-3 text-xs text-stone">
                <span className="flex items-center gap-1">
                  <span className="h-2 w-3 rounded-sm" style={{ backgroundColor: C.seal }} />
                  支出
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-3 rounded-sm" style={{ backgroundColor: C.income }} />
                  收入
                </span>
              </div>
            </div>
            <div className="h-40">
              <ResponsiveContainer>
                <BarChart
                  data={trend}
                  margin={{ top: 4, right: 0, bottom: 0, left: 0 }}
                  barGap={2}
                  barCategoryGap="24%"
                  // 点整个月份列带即可跳月，比点细柱子容易（尤其手机上）
                  onClick={(state) => {
                    // recharts 3 的 activeTooltipIndex 可能是字符串
                    const i = Number(state?.activeTooltipIndex)
                    if (Number.isInteger(i) && i >= 0) jumpToTrendMonth(i)
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={{ stroke: C.hairline }}
                    tick={{ fontSize: 10, fill: C.stone }}
                  />
                  <YAxis hide />
                  <Tooltip
                    cursor={{ fill: C.hairline, opacity: 0.4 }}
                    content={<TrendTooltip currency={currency} c={C} tooltipStyle={tooltipStyle} />}
                  />
                  <Bar
                    dataKey="expense"
                    fill={C.seal}
                    maxBarSize={18}
                    radius={[3, 3, 0, 0]}
                    isAnimationActive={false}
                  >
                    {trend.map((d) => (
                      <Cell key={d.month} fillOpacity={d.month === month ? 1 : 0.55} />
                    ))}
                  </Bar>
                  <Bar
                    dataKey="income"
                    fill={C.income}
                    maxBarSize={18}
                    radius={[3, 3, 0, 0]}
                    isAnimationActive={false}
                  >
                    {trend.map((d) => (
                      <Cell key={d.month} fillOpacity={d.month === month ? 1 : 0.55} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-1 text-center text-[11px] text-stone">点柱子可跳到该月</p>
          </section>

          {/* 近半年结余走势 */}
          <BalanceLine trend={trend} currency={currency} />

          {/* 分类支出趋势 */}
          <CategoryTrendChart
            rangeTxs={convTxs}
            months={trend.map((t) => t.month)}
            catMap={catMap}
            currency={currency}
          />
        </div>
      )}
    </div>
  )
}

/** tooltip 明细最多列几类，超出折叠成「其他」 */
const MAX_TOOLTIP_ROWS = 5

function DailyTooltip({
  active,
  payload,
  month,
  currency,
  c,
  tooltipStyle,
}: {
  active?: boolean
  payload?: {
    payload: {
      day: number
      value: number
      breakdown: { id: string; icon: string; name: string; amount: number }[]
    }
  }[]
  month: string
  currency: string
  c: ChartColors
  tooltipStyle: React.CSSProperties
}) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  if (d.value <= 0) return null // 没花钱的天不弹
  const [y, m] = month.split('-').map(Number)
  const weekday = WEEKDAYS[new Date(y, m - 1, d.day).getDay()]
  const shown = d.breakdown.slice(0, MAX_TOOLTIP_ROWS)
  const rest = d.breakdown.slice(MAX_TOOLTIP_ROWS).reduce((s, b) => s + b.amount, 0)
  return (
    <div style={tooltipStyle}>
      <p className="font-medium">
        {m}月{d.day}日 周{weekday}
      </p>
      <p className="num mt-0.5">
        支出 {currency}
        {fmtMoney(d.value)}
      </p>
      <div className="mt-1 space-y-0.5 border-t pt-1" style={{ borderColor: c.hairline }}>
        {shown.map((b) => (
          <p key={b.id} className="flex items-center justify-between gap-4">
            <span>
              {b.icon} {b.name}
            </span>
            <span className="num">{fmtMoney(b.amount)}</span>
          </p>
        ))}
        {rest > 0 && (
          <p className="flex items-center justify-between gap-4">
            <span>… 其他</span>
            <span className="num">{fmtMoney(rest)}</span>
          </p>
        )}
      </div>
    </div>
  )
}

function TrendTooltip({
  active,
  payload,
  currency,
  c,
  tooltipStyle,
}: {
  active?: boolean
  payload?: { payload: { month: string; expense: number; income: number } }[]
  currency: string
  c: ChartColors
  tooltipStyle: React.CSSProperties
}) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  const balance = d.income - d.expense
  return (
    <div style={tooltipStyle}>
      <p className="font-medium">{fmtMonth(d.month)}</p>
      <p className="num mt-1 flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: c.seal }} />
        支出 {currency}{fmtMoney(d.expense)}
      </p>
      <p className="num mt-0.5 flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: c.income }} />
        收入 {currency}{fmtMoney(d.income)}
      </p>
      <p className="num mt-1 border-t pt-1" style={{ borderColor: c.hairline }}>
        结余 {balance >= 0 ? '+' : '−'}{currency}{fmtMoney(Math.abs(balance))}
      </p>
    </div>
  )
}
