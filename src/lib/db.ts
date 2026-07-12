import { supabase } from './supabase'
import { monthRange } from './format'
import { demoEnabled, mock } from './mockDb'
import type {
  Category,
  CategoryRule,
  NewRecurringItem,
  NewTransaction,
  RecurringItem,
  Transaction,
} from './types'

export async function fetchCategories(): Promise<Category[]> {
  if (demoEnabled()) return mock.fetchCategories()
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order')
  if (error) throw error
  return data
}

export async function fetchTransactions(month: string): Promise<Transaction[]> {
  if (demoEnabled()) return mock.fetchTransactions(month)
  const [start, end] = monthRange(month)
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .gte('date', start)
    .lt('date', end)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return data.map((t) => ({ ...t, amount: Number(t.amount) }))
}

/** 区间流水 [fromMonth 首日, toMonth 下月首日)，分析页跨月统计用 */
export async function fetchTransactionsRange(
  fromMonth: string,
  toMonth: string,
): Promise<Transaction[]> {
  if (demoEnabled()) return mock.fetchTransactionsRange(fromMonth, toMonth)
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .gte('date', monthRange(fromMonth)[0])
    .lt('date', monthRange(toMonth)[1])
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return data.map((t) => ({ ...t, amount: Number(t.amount) }))
}

/** 全量流水（导出用）；个人数据量小，不做分页 */
export async function fetchAllTransactions(): Promise<Transaction[]> {
  if (demoEnabled()) return mock.fetchAllTransactions()
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return data.map((t) => ({ ...t, amount: Number(t.amount) }))
}

export async function insertTransaction(tx: NewTransaction): Promise<void> {
  if (demoEnabled()) return mock.insertTransaction(tx)
  const { data: userData } = await supabase.auth.getUser()
  const { error } = await supabase
    .from('transactions')
    .insert({ ...tx, user_id: userData.user!.id })
  if (error) throw error
}

export async function insertTransactions(txs: NewTransaction[]): Promise<void> {
  if (demoEnabled()) return mock.insertTransactions(txs)
  const { data: userData } = await supabase.auth.getUser()
  const uid = userData.user!.id
  const { error } = await supabase
    .from('transactions')
    .insert(txs.map((t) => ({ ...t, user_id: uid })))
  if (error) throw error
}

export async function updateTransaction(id: string, patch: Partial<NewTransaction>): Promise<void> {
  if (demoEnabled()) return mock.updateTransaction(id, patch)
  const { error } = await supabase.from('transactions').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteTransaction(id: string): Promise<void> {
  if (demoEnabled()) return mock.deleteTransaction(id)
  const { error } = await supabase.from('transactions').delete().eq('id', id)
  if (error) throw error
}

/** 查询已存在的 import_hash，用于导入前去重 */
export async function fetchExistingHashes(hashes: string[]): Promise<Set<string>> {
  if (demoEnabled()) return mock.fetchExistingHashes(hashes)
  if (hashes.length === 0) return new Set()
  const found = new Set<string>()
  // in 查询按批分片，避免 URL 过长
  for (let i = 0; i < hashes.length; i += 200) {
    const batch = hashes.slice(i, i + 200)
    const { data, error } = await supabase
      .from('transactions')
      .select('import_hash')
      .in('import_hash', batch)
    if (error) throw error
    for (const row of data) if (row.import_hash) found.add(row.import_hash)
  }
  return found
}

export async function fetchRules(): Promise<CategoryRule[]> {
  if (demoEnabled()) return mock.fetchRules()
  const { data, error } = await supabase.from('category_rules').select('*')
  if (error) throw error
  return data
}

export async function saveRule(keyword: string, categoryId: string): Promise<void> {
  if (demoEnabled()) return mock.saveRule(keyword, categoryId)
  const { data: userData } = await supabase.auth.getUser()
  // 同关键词重选分类时更新为最新意图（依赖 002 迁移的唯一约束）
  const { error } = await supabase
    .from('category_rules')
    .upsert(
      { user_id: userData.user!.id, keyword, category_id: categoryId },
      { onConflict: 'user_id,keyword' },
    )
  if (error) throw error
}

export async function fetchRecurringItems(): Promise<RecurringItem[]> {
  if (demoEnabled()) return mock.fetchRecurringItems()
  const { data, error } = await supabase
    .from('recurring_items')
    .select('*')
    .order('sort_order')
    .order('created_at')
  if (error) throw error
  return data.map((r) => ({ ...r, amount: Number(r.amount) }))
}

export async function insertRecurringItem(item: NewRecurringItem): Promise<void> {
  if (demoEnabled()) return mock.insertRecurringItem(item)
  const { data: userData } = await supabase.auth.getUser()
  const { error } = await supabase
    .from('recurring_items')
    .insert({ ...item, user_id: userData.user!.id })
  if (error) throw error
}

export async function updateRecurringItem(
  id: string,
  patch: Partial<NewRecurringItem>,
): Promise<void> {
  if (demoEnabled()) return mock.updateRecurringItem(id, patch)
  const { error } = await supabase.from('recurring_items').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteRecurringItem(id: string): Promise<void> {
  if (demoEnabled()) return mock.deleteRecurringItem(id)
  const { error } = await supabase.from('recurring_items').delete().eq('id', id)
  if (error) throw error
}

/** 关键词匹配：描述包含 keyword 即命中，keyword 更长者优先 */
export function matchRule(description: string, rules: CategoryRule[]): string | null {
  const desc = description.toLowerCase()
  let best: CategoryRule | null = null
  for (const r of rules) {
    if (desc.includes(r.keyword.toLowerCase())) {
      if (!best || r.keyword.length > best.keyword.length) best = r
    }
  }
  return best?.category_id ?? null
}
