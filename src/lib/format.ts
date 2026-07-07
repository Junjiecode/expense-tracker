export const CURRENCY = '¥'

export function fmtMoney(n: number): string {
  return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** 本地时区的 YYYY-MM-DD（不能用 toISOString，会跳到 UTC 日期） */
export function todayStr(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 月份键 YYYY-MM */
export function monthKey(d = new Date()): string {
  return todayStr(d).slice(0, 7)
}

/** 某月的起止日期 [首日, 下月首日) */
export function monthRange(month: string): [string, string] {
  const [y, m] = month.split('-').map(Number)
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`
  return [`${month}-01`, `${next}-01`]
}

export function prevMonth(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`
}

export function nextMonth(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`
}

export function fmtMonth(month: string): string {
  const [y, m] = month.split('-')
  return `${y}年${Number(m)}月`
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

export function fmtDateLabel(date: string): string {
  const today = todayStr()
  if (date === today) return '今天'
  const d = new Date(date + 'T00:00:00')
  const yesterday = todayStr(new Date(Date.now() - 86400000))
  if (date === yesterday) return '昨天'
  return `${d.getMonth() + 1}月${d.getDate()}日 周${WEEKDAYS[d.getDay()]}`
}

export async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
