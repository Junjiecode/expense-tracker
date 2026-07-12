export type TxType = 'expense' | 'income'

export interface Category {
  id: string
  user_id: string
  name: string
  icon: string
  color: string
  type: TxType
  sort_order: number
}

export interface Transaction {
  id: string
  user_id: string
  date: string // YYYY-MM-DD
  amount: number // 始终为正数，方向由 type 决定
  type: TxType
  description: string
  category_id: string | null
  note: string
  source: 'manual' | 'csv'
  import_hash: string | null
  created_at: string
}

export interface CategoryRule {
  id: string
  user_id: string
  keyword: string
  category_id: string
}

export interface NewTransaction {
  date: string
  amount: number
  type: TxType
  description: string
  category_id: string | null
  note: string
  source: 'manual' | 'csv'
  import_hash: string | null
}

/** 固定收支模板项：每月一键记入，本身不是账目 */
export interface RecurringItem {
  id: string
  user_id: string
  name: string
  amount: number // 始终为正数，方向由 type 决定
  type: TxType
  category_id: string | null
  note: string
  day_of_month: number // 1-31，记入时超出当月天数则夹到月末
  sort_order: number
}

export type NewRecurringItem = Omit<RecurringItem, 'id' | 'user_id'>
