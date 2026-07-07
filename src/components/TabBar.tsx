export type Tab = 'add' | 'list' | 'import' | 'dash'

const TABS: { key: Tab; label: string; icon: (active: boolean) => React.ReactNode }[] = [
  {
    key: 'add',
    label: '记一笔',
    icon: (a) => (
      <Svg a={a}>
        <path d="M12 5v14M5 12h14" strokeLinecap="round" />
      </Svg>
    ),
  },
  {
    key: 'list',
    label: '账单',
    icon: (a) => (
      <Svg a={a}>
        <path d="M6 4h12v16l-2-1.4L14 20l-2-1.4L10 20l-2-1.4L6 20V4Z" strokeLinejoin="round" />
        <path d="M9 9h6M9 13h4" strokeLinecap="round" />
      </Svg>
    ),
  },
  {
    key: 'import',
    label: '导入',
    icon: (a) => (
      <Svg a={a}>
        <path d="M12 4v10m0 0-4-4m4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5 17v3h14v-3" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    ),
  },
  {
    key: 'dash',
    label: '分析',
    icon: (a) => (
      <Svg a={a}>
        <path d="M5 20V10M12 20V4M19 20v-7" strokeLinecap="round" />
      </Svg>
    ),
  },
]

function Svg({ a, children }: { a: boolean; children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth={a ? 2.2 : 1.8}
    >
      {children}
    </svg>
  )
}

export default function TabBar({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-hairline bg-paper/95 backdrop-blur pb-safe">
      <div className="mx-auto flex max-w-lg">
        {TABS.map((t) => {
          const active = tab === t.key
          return (
            <button
              key={t.key}
              onClick={() => onChange(t.key)}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 ${
                active ? 'text-seal' : 'text-stone'
              }`}
            >
              {t.icon(active)}
              <span className={`text-[11px] ${active ? 'font-semibold' : ''}`}>{t.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
