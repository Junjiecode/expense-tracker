export type Currency = '€' | '¥'

const CURRENCY_KEY = 'currency'

/** 全局显示币种：统计/汇总折算的目标币种，默认欧元 */
export function getCurrency(): Currency {
  return localStorage.getItem(CURRENCY_KEY) === '¥' ? '¥' : '€'
}

export function setCurrency(c: Currency): void {
  localStorage.setItem(CURRENCY_KEY, c)
}

const RATE_KEY = 'eur-cny-rate'
const DEFAULT_RATE = 7.8

/** 汇率：1€ 兑多少 ¥，设置里手动维护 */
export function getRate(): number {
  const n = parseFloat(localStorage.getItem(RATE_KEY) ?? '')
  return n > 0 ? n : DEFAULT_RATE
}

export function setRate(r: number): void {
  localStorage.setItem(RATE_KEY, String(r))
}

/** 折算金额；不做舍入，显示时再舍 */
export function convert(amount: number, from: Currency, to: Currency, rate = getRate()): number {
  if (from === to) return amount
  return from === '€' ? amount * rate : amount / rate
}

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

export const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

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
