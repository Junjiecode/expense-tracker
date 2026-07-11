import { Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { fmtMoney, fmtMonth } from '../../lib/format'
import { useChartTheme } from './chartTheme'
import type { ChartColors } from './chartTheme'

export interface TrendPoint {
  month: string
  label: string
  expense: number
  income: number
}

/** 近半年结余走势：收入 − 支出，正负靠零线读 */
export default function BalanceLine({ trend, currency }: { trend: TrendPoint[]; currency: string }) {
  const { C, tooltipStyle } = useChartTheme()
  const data = trend.map((t) => ({
    ...t,
    balance: Math.round((t.income - t.expense) * 100) / 100,
  }))

  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold text-ink-soft">近半年结余</h2>
      <div className="h-40">
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={{ stroke: C.hairline }}
              tick={{ fontSize: 10, fill: C.stone }}
            />
            <YAxis hide />
            <ReferenceLine y={0} stroke={C.stone} strokeDasharray="4 3" />
            <Tooltip content={<BalanceTooltip currency={currency} c={C} tooltipStyle={tooltipStyle} />} />
            <Line
              dataKey="balance"
              stroke={C.ink}
              strokeWidth={2}
              dot={{ r: 3.5, fill: C.ink, strokeWidth: 0 }}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}

function BalanceTooltip({
  active,
  payload,
  currency,
  c,
  tooltipStyle,
}: {
  active?: boolean
  payload?: { payload: TrendPoint & { balance: number } }[]
  currency: string
  c: ChartColors
  tooltipStyle: React.CSSProperties
}) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  const positive = d.balance >= 0
  return (
    <div style={tooltipStyle}>
      <p className="font-medium">{fmtMonth(d.month)}</p>
      <p className="num mt-1 font-semibold" style={{ color: positive ? c.income : c.seal }}>
        结余 {positive ? '+' : '−'}{currency}{fmtMoney(Math.abs(d.balance))}
      </p>
    </div>
  )
}
