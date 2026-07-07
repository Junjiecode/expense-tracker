// 演示模式：无 Supabase 配置时的内存数据源，方便先体验再接后端
import { isConfigured } from './supabase'
import type { Category, CategoryRule, NewTransaction, Transaction } from './types'
import { monthKey, monthRange, prevMonth, todayStr } from './format'

const UID = 'demo'

// 配置好真实后端后，残留的演示开关必须失效
export function demoEnabled(): boolean {
  return !isConfigured && localStorage.getItem('demo-mode') === '1'
}

export function enableDemo(): void {
  localStorage.setItem('demo-mode', '1')
}

const seed: [string, string, string, 'expense' | 'income'][] = [
  ['餐饮', '🍜', '#EB6834', 'expense'],
  ['交通', '🚇', '#2A78D6', 'expense'],
  ['购物', '🛍️', '#E87BA4', 'expense'],
  ['日用', '🧺', '#1BAF7A', 'expense'],
  ['居住', '🏠', '#4A3AA7', 'expense'],
  ['娱乐', '🎮', '#EDA100', 'expense'],
  ['医疗', '💊', '#E34948', 'expense'],
  ['订阅', '📱', '#008300', 'expense'],
  ['其他', '📝', '#8A8A82', 'expense'],
  ['工资', '💰', '#2E7D5B', 'income'],
  ['其他收入', '🪙', '#199E70', 'income'],
]

const categories: Category[] = seed.map(([name, icon, color, type], i) => ({
  id: `cat-${i}`,
  user_id: UID,
  name,
  icon,
  color,
  type,
  sort_order: i,
}))

let nextId = 1
const transactions: Transaction[] = []

function addDemoTx(date: string, amount: number, catIdx: number, note = '') {
  transactions.push({
    id: `tx-${nextId++}`,
    user_id: UID,
    date,
    amount,
    type: categories[catIdx].type,
    description: '',
    category_id: categories[catIdx].id,
    note,
    source: 'manual',
    import_hash: null,
    created_at: new Date().toISOString(),
  })
}

// 造两个月的演示数据
{
  const cur = monthKey()
  const prev = prevMonth(cur)
  const today = Number(todayStr().slice(8, 10))
  const samples: [number, number, number, string][] = [
    [1, 32.5, 0, '早餐'], [1, 8, 1, '地铁'], [2, 128, 2, ''], [3, 45.8, 0, '午饭'],
    [4, 15.9, 3, '洗衣液'], [5, 2200, 4, '房租'], [6, 68, 5, '电影'], [7, 25, 0, ''],
    [8, 9.9, 7, '视频会员'], [9, 88, 0, '聚餐'], [10, 12, 1, ''], [11, 199, 2, '球鞋'],
    [12, 36, 0, ''], [13, 50, 6, '感冒药'], [14, 20, 1, '打车'],
  ]
  for (const [day, amt, cat, note] of samples) {
    if (day <= today) addDemoTx(`${cur}-${String(day).padStart(2, '0')}`, amt, cat, note)
    addDemoTx(`${prev}-${String(day).padStart(2, '0')}`, amt * 1.15, cat, note)
  }
  if (today >= 1) addDemoTx(`${cur}-01`, 12000, 9, '月薪')
  addDemoTx(`${prev}-01`, 12000, 9, '月薪')
}

const rules: CategoryRule[] = []

export const mock = {
  async fetchCategories(): Promise<Category[]> {
    return [...categories]
  },
  async fetchTransactions(month: string): Promise<Transaction[]> {
    const [start, end] = monthRange(month)
    return transactions
      .filter((t) => t.date >= start && t.date < end)
      .sort((a, b) => (a.date === b.date ? b.created_at.localeCompare(a.created_at) : b.date.localeCompare(a.date)))
      .map((t) => ({ ...t }))
  },
  async insertTransaction(tx: NewTransaction): Promise<void> {
    transactions.push({
      ...tx,
      id: `tx-${nextId++}`,
      user_id: UID,
      created_at: new Date().toISOString(),
    })
  },
  async insertTransactions(txs: NewTransaction[]): Promise<void> {
    for (const t of txs) await mock.insertTransaction(t)
  },
  async updateTransaction(id: string, patch: Partial<NewTransaction>): Promise<void> {
    const t = transactions.find((t) => t.id === id)
    if (t) Object.assign(t, patch)
  },
  async deleteTransaction(id: string): Promise<void> {
    const i = transactions.findIndex((t) => t.id === id)
    if (i >= 0) transactions.splice(i, 1)
  },
  async fetchExistingHashes(hashes: string[]): Promise<Set<string>> {
    const all = new Set(transactions.map((t) => t.import_hash).filter(Boolean) as string[])
    return new Set(hashes.filter((h) => all.has(h)))
  },
  async fetchRules(): Promise<CategoryRule[]> {
    return [...rules]
  },
  async saveRule(keyword: string, categoryId: string): Promise<void> {
    rules.push({ id: `rule-${rules.length}`, user_id: UID, keyword, category_id: categoryId })
  },
}
