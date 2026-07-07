import type { Category, TxType } from '../lib/types'

interface Props {
  categories: Category[]
  type: TxType
  selected: string | null
  onSelect: (id: string) => void
}

export default function CategoryGrid({ categories, type, selected, onSelect }: Props) {
  const list = categories.filter((c) => c.type === type)
  return (
    <div className="grid grid-cols-4 gap-y-4">
      {list.map((c) => {
        const active = selected === c.id
        return (
          <button
            key={c.id}
            onClick={() => onSelect(c.id)}
            className="flex flex-col items-center gap-1.5"
          >
            <span
              className="flex h-12 w-12 items-center justify-center rounded-full text-xl transition-transform active:scale-90"
              style={{
                backgroundColor: active ? c.color : `${c.color}1A`,
                boxShadow: active ? `0 0 0 2px ${c.color}` : undefined,
              }}
            >
              {c.icon}
            </span>
            <span className={`text-xs ${active ? 'font-semibold text-ink' : 'text-ink-soft'}`}>
              {c.name}
            </span>
          </button>
        )
      })}
    </div>
  )
}
