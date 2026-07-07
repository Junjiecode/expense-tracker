import { fmtMonth, monthKey, nextMonth, prevMonth } from '../lib/format'

interface Props {
  month: string
  onChange: (m: string) => void
}

export default function MonthSwitcher({ month, onChange }: Props) {
  const atCurrent = month >= monthKey()
  return (
    <div className="flex items-center justify-center gap-4 py-1">
      <button
        onClick={() => onChange(prevMonth(month))}
        className="px-3 py-1 text-lg text-stone active:text-ink"
        aria-label="上个月"
      >
        ‹
      </button>
      <span className="min-w-28 text-center font-semibold">{fmtMonth(month)}</span>
      <button
        onClick={() => onChange(nextMonth(month))}
        disabled={atCurrent}
        className="px-3 py-1 text-lg text-stone active:text-ink disabled:opacity-30"
        aria-label="下个月"
      >
        ›
      </button>
    </div>
  )
}
