// CSV 导入的解析辅助：日期/金额的宽容解析 + 列自动猜测

export type DateFormat = 'auto' | 'ymd' | 'mdy' | 'dmy'

/** 解析各种常见银行日期写法，返回 YYYY-MM-DD，失败返回 null */
export function parseDate(raw: string, fmt: DateFormat): string | null {
  const s = raw.trim().split(/[ T]/)[0] // 去掉时间部分
  if (!s) return null

  const iso = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/)
  if (iso) return build(iso[1], iso[2], iso[3])

  const compact = s.match(/^(\d{4})(\d{2})(\d{2})$/)
  if (compact) return build(compact[1], compact[2], compact[3])

  const two = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/)
  if (two) {
    const year = two[3].length === 2 ? `20${two[3]}` : two[3]
    const [a, b] = [two[1], two[2]]
    if (fmt === 'dmy') return build(year, b, a)
    if (fmt === 'mdy') return build(year, a, b)
    // auto：a>12 只能是日，b>12 只能是日，否则按 M/D
    if (Number(a) > 12) return build(year, b, a)
    return build(year, a, b)
  }
  return null
}

function build(y: string, m: string, d: string): string | null {
  const mm = Number(m)
  const dd = Number(d)
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null
  return `${y}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`
}

/** 解析金额："1,234.56"、"¥12"、"(45.00)"（负数）等，失败返回 null */
export function parseAmount(raw: string): number | null {
  let s = raw.trim()
  if (!s) return null
  let negative = false
  if (/^\(.*\)$/.test(s)) {
    negative = true
    s = s.slice(1, -1)
  }
  s = s.replace(/[^0-9.-]/g, '')
  if (!s || s === '-' || s === '.') return null
  const n = parseFloat(s)
  if (Number.isNaN(n)) return null
  return negative ? -n : n
}

/** 根据数据内容猜测 日期/金额/描述 列的下标 */
export function guessColumns(rows: string[][]): { date: number; amount: number; desc: number } {
  const cols = rows[0]?.length ?? 0
  const sample = rows.slice(0, 20)
  let date = -1
  let amount = -1
  const score = (idx: number, fn: (v: string) => boolean) =>
    sample.filter((r) => r[idx] && fn(r[idx])).length / sample.length

  for (let i = 0; i < cols; i++) {
    if (date === -1 && score(i, (v) => parseDate(v, 'auto') !== null) > 0.7) date = i
  }
  for (let i = 0; i < cols; i++) {
    if (i === date) continue
    if (amount === -1 && score(i, (v) => parseAmount(v) !== null) > 0.7) amount = i
  }
  // 描述列：非日期非金额里平均文本最长的
  let desc = -1
  let best = -1
  for (let i = 0; i < cols; i++) {
    if (i === date || i === amount) continue
    const avg = sample.reduce((s, r) => s + (r[i]?.length ?? 0), 0) / sample.length
    if (avg > best) {
      best = avg
      desc = i
    }
  }
  return { date: Math.max(date, 0), amount: Math.max(amount, 0), desc: Math.max(desc, 0) }
}
