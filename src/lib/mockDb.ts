// 演示模式：无 Supabase 配置时的内存数据源，方便先体验再接后端
import { isConfigured } from './supabase'
import type {
  Category,
  CategoryRule,
  NewCategory,
  NewRecurringItem,
  NewTransaction,
  RecurringItem,
  Transaction,
} from './types'
import { monthKey, monthRange, prevMonth, todayStr } from './format'
import type { Currency } from './format'

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

let nextCatId = seed.length

let nextId = 1
const transactions: Transaction[] = []

function addDemoTx(date: string, amount: number, catIdx: number, note = '', currency: Currency = '€') {
  transactions.push({
    id: `tx-${nextId++}`,
    user_id: UID,
    date,
    amount,
    currency,
    type: categories[catIdx].type,
    description: '',
    category_id: categories[catIdx].id,
    note,
    source: 'manual',
    import_hash: null,
    created_at: new Date().toISOString(),
  })
}

// 造六个月的演示数据（趋势图需要），金额按月乘确定性起伏系数
{
  const today = Number(todayStr().slice(8, 10))
  const samples: [number, number, number, string, Currency?][] = [
    [1, 32.5, 0, '早餐'], [1, 8, 1, '地铁'], [2, 128, 2, ''], [3, 45.8, 0, '午饭'],
    [4, 15.9, 3, '洗衣液'], [5, 2200, 4, '房租'], [6, 68, 5, '电影'], [7, 25, 0, ''],
    [8, 9.9, 7, '视频会员'], [9, 288, 0, '国内聚餐', '¥'], [10, 12, 1, ''], [11, 599, 2, '淘宝球鞋', '¥'],
    [12, 36, 0, ''], [13, 50, 6, '感冒药'], [14, 20, 1, '打车'],
  ]
  const factors = [1, 1.15, 0.85, 1.3, 0.95, 1.1]
  let m = monthKey()
  for (let i = 0; i < 6; i++) {
    for (const [day, amt, cat, note, cur] of samples) {
      if (i === 0 && day > today) continue
      addDemoTx(`${m}-${String(day).padStart(2, '0')}`, Math.round(amt * factors[i] * 100) / 100, cat, note, cur)
    }
    addDemoTx(`${m}-01`, 12000, 9, '月薪')
    m = prevMonth(m)
  }
}

const rules: CategoryRule[] = []

let nextRecId = 1
const recurringItems: RecurringItem[] = []

export const mock = {
  async fetchCategories(): Promise<Category[]> {
    return [...categories].sort((a, b) => a.sort_order - b.sort_order).map((c) => ({ ...c }))
  },
  async insertCategory(cat: NewCategory): Promise<void> {
    categories.push({ ...cat, id: `cat-${nextCatId++}`, user_id: UID })
  },
  async updateCategory(id: string, patch: Partial<NewCategory>): Promise<void> {
    const c = categories.find((c) => c.id === id)
    if (c) Object.assign(c, patch)
  },
  async deleteCategory(id: string): Promise<void> {
    const i = categories.findIndex((c) => c.id === id)
    if (i < 0) return
    categories.splice(i, 1)
    // 镜像 DB 外键行为：账目 set null，规则级联删除
    for (const t of transactions) if (t.category_id === id) t.category_id = null
    for (let j = rules.length - 1; j >= 0; j--) if (rules[j].category_id === id) rules.splice(j, 1)
  },
  async fetchTransactions(month: string): Promise<Transaction[]> {
    const [start, end] = monthRange(month)
    return transactions
      .filter((t) => t.date >= start && t.date < end)
      .sort((a, b) => (a.date === b.date ? b.created_at.localeCompare(a.created_at) : b.date.localeCompare(a.date)))
      .map((t) => ({ ...t }))
  },
  async fetchTransactionsRange(fromMonth: string, toMonth: string): Promise<Transaction[]> {
    const start = monthRange(fromMonth)[0]
    const end = monthRange(toMonth)[1]
    return transactions
      .filter((t) => t.date >= start && t.date < end)
      .sort((a, b) => (a.date === b.date ? b.created_at.localeCompare(a.created_at) : b.date.localeCompare(a.date)))
      .map((t) => ({ ...t }))
  },
  async fetchAllTransactions(): Promise<Transaction[]> {
    return [...transactions]
      .sort((a, b) => (a.date === b.date ? b.created_at.localeCompare(a.created_at) : b.date.localeCompare(a.date)))
      .map((t) => ({ ...t }))
  },
  async insertTransaction(tx: NewTransaction): Promise<void> {
    // 镜像 transactions_import_dedup 唯一索引：同 hash 拒绝重复入账
    if (tx.import_hash && transactions.some((t) => t.import_hash === tx.import_hash)) {
      throw new Error('duplicate key value violates unique constraint "transactions_import_dedup"')
    }
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
    const existing = rules.find((r) => r.keyword === keyword)
    if (existing) existing.category_id = categoryId
    else rules.push({ id: `rule-${rules.length}`, user_id: UID, keyword, category_id: categoryId })
  },
  async fetchRecurringItems(): Promise<RecurringItem[]> {
    return [...recurringItems].sort((a, b) => a.sort_order - b.sort_order).map((r) => ({ ...r }))
  },
  async insertRecurringItem(item: NewRecurringItem): Promise<void> {
    recurringItems.push({ ...item, id: `rec-${nextRecId++}`, user_id: UID })
  },
  async updateRecurringItem(id: string, patch: Partial<NewRecurringItem>): Promise<void> {
    const r = recurringItems.find((r) => r.id === id)
    if (r) Object.assign(r, patch)
  },
  async deleteRecurringItem(id: string): Promise<void> {
    const i = recurringItems.findIndex((r) => r.id === id)
    if (i >= 0) recurringItems.splice(i, 1)
  },
}
