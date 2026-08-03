// 固定收支模板 → 当月账目的纯函数逻辑
import type { Currency } from './format'
import type { NewTransaction, RecurringItem, Transaction } from './types'

/** 当月第 day 号的 YYYY-MM-DD，超出当月天数夹到月末（如 2 月 31 号 → 28/29 号） */
export function dayInMonth(month: string, day: number): string {
  const [y, m] = month.split('-').map(Number)
  const last = new Date(y, m, 0).getDate()
  return `${month}-${String(Math.min(day, last)).padStart(2, '0')}`
}

/** 记入标记：写进 import_hash，配合 (user_id, import_hash) 唯一索引保证同项同月只入一次 */
export function recurringHash(itemId: string, month: string): string {
  return `rec:${itemId}:${month}`
}

/** 把选中的模板项转成待插入账目；amount/date 允许在确认单里被覆写 */
export function buildRecurringTx(
  item: RecurringItem,
  month: string,
  currency: Currency,
  overrides?: { amount?: number; date?: string },
): NewTransaction {
  return {
    date: overrides?.date ?? dayInMonth(month, item.day_of_month),
    amount: overrides?.amount ?? item.amount,
    currency,
    type: item.type,
    description: '',
    category_id: item.category_id,
    note: item.note || item.name,
    source: 'manual',
    import_hash: recurringHash(item.id, month),
  }
}

/** 固定收支模板「记入本月」生成的账目，import_hash 带 rec: 前缀 */
export function isRecurringTx(t: Pick<Transaction, 'import_hash'>): boolean {
  return !!t.import_hash?.startsWith('rec:')
}
