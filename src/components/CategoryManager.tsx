import { useState } from 'react'
import type { Category, TxType } from '../lib/types'
import { deleteCategory, insertCategory, updateCategory } from '../lib/db'

/** 可选色板：11 个种子色，已过色觉安全校验，深色映射在 chartTheme.ts 覆盖 */
const PALETTE = [
  '#EB6834',
  '#2A78D6',
  '#E87BA4',
  '#1BAF7A',
  '#4A3AA7',
  '#EDA100',
  '#E34948',
  '#008300',
  '#2E7D5B',
  '#199E70',
  '#8A8A82',
]

const QUICK_EMOJIS = ['🍜', '🚇', '🛍️', '🏠', '🎮', '💊', '✈️', '🎓', '🐱', '🎁', '💰', '📝']

interface SectionProps {
  categories: Category[]
  toast: (msg: string) => void
  /** 分类增删改后通知外层重新拉取分类 */
  onChanged: () => void
}

/** 设置面板里的「分类管理」板块：分类列表 + 新增/编辑/删除 */
export default function CategorySection({ categories, toast, onChanged }: SectionProps) {
  const [editing, setEditing] = useState<Category | 'new' | null>(null)
  const nextSortOrder = categories.reduce((m, c) => Math.max(m, c.sort_order), 0) + 1

  const groups: { type: TxType; label: string }[] = [
    { type: 'expense', label: '支出' },
    { type: 'income', label: '收入' },
  ]

  return (
    <div className="space-y-3">
      <p className="text-[13px] font-medium text-ink-soft">分类管理（点击分类可编辑）</p>

      {groups.map(({ type, label }) => {
        const list = categories.filter((c) => c.type === type)
        if (list.length === 0) return null
        return (
          <div key={type}>
            <p className="mb-1.5 text-xs text-stone">{label}</p>
            <ul className="divide-y divide-hairline rounded-xl border border-hairline">
              {list.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => setEditing(c)}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left active:bg-hairline/50"
                  >
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base"
                      style={{ backgroundColor: `${c.color}1A` }}
                    >
                      {c.icon}
                    </span>
                    <span className="flex-1 truncate text-sm font-medium">{c.name}</span>
                    <span className="h-3.5 w-3.5 shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )
      })}

      <button
        onClick={() => setEditing('new')}
        className="w-full rounded-xl border border-hairline bg-paper-raised py-2.5 text-sm font-medium active:bg-hairline"
      >
        + 新增分类
      </button>

      {editing && (
        <CategoryEditor
          cat={editing === 'new' ? null : editing}
          nextSortOrder={nextSortOrder}
          toast={toast}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            onChanged()
          }}
        />
      )}
    </div>
  )
}

/** 新增/编辑分类（嵌套弹层，盖在设置面板之上） */
function CategoryEditor({
  cat,
  nextSortOrder,
  toast,
  onClose,
  onSaved,
}: {
  cat: Category | null
  nextSortOrder: number
  toast: (msg: string) => void
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(cat?.name ?? '')
  const [type, setType] = useState<TxType>(cat?.type ?? 'expense')
  const [icon, setIcon] = useState(cat?.icon ?? '📝')
  const [color, setColor] = useState(cat?.color ?? PALETTE[0])
  const [busy, setBusy] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)

  async function save() {
    if (!name.trim()) return toast('先起个名字（如：宠物）')
    if (!icon.trim()) return toast('选一个图标')
    setBusy(true)
    try {
      const payload = {
        name: name.trim(),
        icon: icon.trim(),
        color,
        type,
        sort_order: cat?.sort_order ?? nextSortOrder,
      }
      if (cat) await updateCategory(cat.id, payload)
      else await insertCategory(payload)
      toast(cat ? '已保存修改' : '已添加分类')
      onSaved()
    } catch (e) {
      toast(`保存失败：${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!cat) return
    if (!confirmDel) {
      setConfirmDel(true)
      setTimeout(() => setConfirmDel(false), 2500)
      return
    }
    setBusy(true)
    try {
      await deleteCategory(cat.id)
      toast('已删除，原账目变为未分类')
      onSaved()
    } catch (e) {
      toast(`删除失败：${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-paper p-5 pb-safe"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-hairline" />
        <h3 className="text-base font-bold">{cat ? '编辑分类' : '新增分类'}</h3>

        <div className="mt-4 space-y-4">
          {/* 支出 / 收入 */}
          <div className="flex justify-center">
            <div className="flex rounded-full border border-hairline bg-paper-raised p-0.5">
              {(['expense', 'income'] as TxType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
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

          <div className="flex gap-2">
            <span
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-xl"
              style={{ backgroundColor: `${color}1A` }}
            >
              {icon || '📝'}
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="名称（如：宠物、健身）"
              className="w-full rounded-xl border border-hairline bg-paper-raised px-4 py-3 text-[15px] outline-none focus:border-seal"
            />
          </div>

          {/* 图标：可输入任意 emoji，或从常用里点选 */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <p className="text-xs text-stone">图标</p>
              <input
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                placeholder="输入 emoji"
                className="w-28 rounded-xl border border-hairline bg-paper-raised px-3 py-1.5 text-center text-base outline-none focus:border-seal"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_EMOJIS.map((e) => (
                <button
                  key={e}
                  onClick={() => setIcon(e)}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg text-base ${
                    icon === e ? 'bg-hairline' : 'bg-paper-raised active:bg-hairline'
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          {/* 颜色：只从已校验色板里选 */}
          <div className="space-y-2">
            <p className="text-xs text-stone">颜色</p>
            <div className="flex flex-wrap gap-2">
              {PALETTE.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  aria-label={c}
                  className="h-8 w-8 rounded-full"
                  style={{
                    backgroundColor: c,
                    boxShadow: color === c ? `0 0 0 2px var(--color-paper), 0 0 0 4px ${c}` : undefined,
                  }}
                />
              ))}
            </div>
          </div>

          <button
            onClick={save}
            disabled={busy}
            className="w-full rounded-xl bg-ink py-3 text-sm font-semibold text-paper disabled:opacity-50"
          >
            {busy ? '保存中…' : '保存'}
          </button>
          {cat && (
            <>
              <button
                onClick={remove}
                disabled={busy}
                className={`w-full rounded-xl border py-2.5 text-sm font-medium ${
                  confirmDel ? 'border-seal bg-seal/5 font-semibold text-seal' : 'border-hairline text-seal'
                }`}
              >
                {confirmDel ? '再点一次确认删除' : '删除此分类'}
              </button>
              <p className="text-center text-xs text-stone">
                删除后该分类下的账目将变为未分类，相关自动分类规则会一并删除
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
