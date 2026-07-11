import { useMemo } from 'react'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Transaction } from '../../lib/types'
import { fmtMoney, monthKey, prevMonth, todayStr } from '../../lib/format'
import { useChartTheme } from './chartTheme'

interface Props {
  rangeTxs: Transaction[]
  month: string
  currency: string
}

function daysInMonth(month: string): number {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

/** 支出节奏：当月逐日累计支出，叠上月同期作参照 */
export default function CumulativeChart({ rangeTxs, month, currency }: Props) {
  const { C, tooltipStyle } = useChartTheme()

  const data = useMemo(() => {
    const pm = prevMonth(month)
    const dCur = daysInMonth(month)
    const dPrev = daysInMonth(pm)
    const cur = new Array<number>(dCur).fill(0)
    const prv = new Array<number>(dPrev).fill(0)
    for (const t of rangeTxs) {
      if (t.type !== 'expense') continue
      const m = t.date.slice(0, 7)
      const d = Number(t.date.slice(8, 10)) - 1
      if (m === month) cur[d] += t.amount
      else if (m === pm) prv[d] += t.amount
    }
    // 当前月只画到今天，历史月画整月；null 让折线截断
    const upTo = month === monthKey() ? Number(todayStr().slice(8, 10)) : dCur
    let a = 0
    let b = 0
    return Array.from({ length: Math.max(dCur, dPrev) }, (_, i) => {
      a += cur[i] ?? 0
      b += prv[i] ?? 0
      return {
        day: i + 1,
        cur: i < upTo && i < dCur ? Math.round(a * 100) / 100 : null,
        prev: i < dPrev ? Math.round(b * 100) / 100 : null,
      }
    })
  }, [rangeTxs, month])

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink-soft">支出节奏</h2>
        <div className="flex items-center gap-3 text-xs text-stone">
          <span className="flex items-center gap-1">
            <span className="h-2 w-3 rounded-sm" style={{ backgroundColor: C.seal }} />
            当月
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-3 rounded-sm" style={{ backgroundColor: C.stone }} />
            上月同期
          </span>
        </div>
      </div>
      <div className="h-40">
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={{ stroke: C.hairline }}
              tick={{ fontSize: 10, fill: C.stone }}
              ticks={[1, 5, 10, 15, 20, 25, data.length]}
            />
            <YAxis hide />
            <Tooltip
              formatter={(v) => `${currency}${fmtMoney(Number(v))}`}
              labelFormatter={(d) => `${d}日累计`}
              contentStyle={tooltipStyle}
              itemStyle={{ color: C.ink }}
            />
            <Line
              dataKey="prev"
              name="上月同期"
              stroke={C.stone}
              strokeWidth={1.5}
              strokeDasharray="5 4"
              dot={false}
              isAnimationActive={false}
            />
            <Line
              dataKey="cur"
              name="当月"
              stroke={C.seal}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}
