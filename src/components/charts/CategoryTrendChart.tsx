import { useMemo } from 'react'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Category, Transaction } from '../../lib/types'
import { fmtMoney, fmtMonth } from '../../lib/format'
import { useChartTheme } from './chartTheme'

/** 折线条数上限：4 条是色觉可分辨的稳妥上限，其余合并成「其他」 */
const MAX_LINES = 4

interface Props {
  rangeTxs: Transaction[]
  months: string[]
  catMap: Map<string, Category>
  currency: string
}

/** 分类趋势：支出 top 分类近半年的逐月走势 */
export default function CategoryTrendChart({ rangeTxs, months, catMap, currency }: Props) {
  const { C, catColor, tooltipStyle } = useChartTheme()

  const { rows, series, hasOther } = useMemo(() => {
    const perMonth = new Map(months.map((m) => [m, new Map<string, number>()]))
    const totals = new Map<string, number>()
    for (const t of rangeTxs) {
      if (t.type !== 'expense') continue
      const bucket = perMonth.get(t.date.slice(0, 7))
      if (!bucket) continue
      const key = t.category_id ?? 'uncat'
      bucket.set(key, (bucket.get(key) ?? 0) + t.amount)
      totals.set(key, (totals.get(key) ?? 0) + t.amount)
    }
    // top 按半年合计选定，色跟分类实体走（切月后幸存的线不换色）
    const top = [...totals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_LINES)
      .map(([id]) => id)
    let otherTotal = 0
    const rows = months.map((m) => {
      const row: Record<string, number | string> = { month: m, label: `${Number(m.slice(5))}月`, other: 0 }
      for (const id of top) row[id] = 0
      for (const [key, v] of perMonth.get(m)!) {
        if (top.includes(key)) {
          row[key] = Math.round(v * 100) / 100
        } else {
          row.other = Math.round(((row.other as number) + v) * 100) / 100
          otherTotal += v
        }
      }
      return row
    })
    const series = top.map((id) => ({
      id,
      name: catMap.get(id)?.name ?? '未分类',
      color: catMap.get(id)?.color ?? '#8A8A82',
    }))
    return { rows, series, hasOther: otherTotal > 0 }
  }, [rangeTxs, months, catMap])

  if (series.length === 0) return null

  return (
    <section>
      <h2 className="mb-1 text-sm font-semibold text-ink-soft">分类趋势</h2>
      {/* 图例兼作色觉次级编码：色块+名字，不靠颜色单独传意 */}
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone">
        {series.map((s) => (
          <span key={s.id} className="flex items-center gap-1">
            <span className="h-2 w-3 rounded-sm" style={{ backgroundColor: catColor(s.color) }} />
            {s.name}
          </span>
        ))}
        {hasOther && (
          <span className="flex items-center gap-1">
            <span className="h-2 w-3 rounded-sm" style={{ backgroundColor: C.stone }} />
            其他
          </span>
        )}
      </div>
      <div className="h-40">
        <ResponsiveContainer>
          <LineChart data={rows} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={{ stroke: C.hairline }}
              tick={{ fontSize: 10, fill: C.stone }}
            />
            <YAxis hide />
            <Tooltip
              contentStyle={tooltipStyle}
              itemStyle={{ color: C.ink }}
              labelFormatter={(_, p) => (p?.[0] ? fmtMonth(String(p[0].payload.month)) : '')}
              formatter={(v) => `${currency}${fmtMoney(Number(v))}`}
              itemSorter={(item) => -Number(item.value)}
            />
            {series.map((s) => (
              <Line
                key={s.id}
                dataKey={s.id}
                name={s.name}
                stroke={catColor(s.color)}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            ))}
            {hasOther && (
              <Line
                dataKey="other"
                name="其他"
                stroke={C.stone}
                strokeWidth={1.5}
                strokeDasharray="5 4"
                dot={false}
                isAnimationActive={false}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}
