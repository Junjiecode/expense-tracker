import type { Category, Transaction } from './types'

/** 字段含逗号/引号/换行时按 CSV 规范转义 */
function esc(field: string): string {
  if (/[",\r\n]/.test(field)) return '"' + field.replace(/"/g, '""') + '"'
  return field
}

/** 生成 CSV 并触发浏览器下载（带 BOM，Excel 打开中文不乱码） */
export function exportTransactionsCsv(
  txs: Transaction[],
  categories: Category[],
  filename: string,
): void {
  const catName = new Map(categories.map((c) => [c.id, c.name]))
  const rows: string[][] = [['日期', '类型', '分类', '金额', '描述', '备注']]
  for (const t of txs) {
    rows.push([
      t.date,
      t.type === 'expense' ? '支出' : '收入',
      (t.category_id && catName.get(t.category_id)) || '未分类',
      t.amount.toFixed(2),
      t.description,
      t.note,
    ])
  }
  const csv = '\uFEFF' + rows.map((r) => r.map(esc).join(',')).join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
