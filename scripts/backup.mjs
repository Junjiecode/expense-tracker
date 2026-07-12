// 月度自动备份脚本：以普通用户身份登录（走 RLS），导出全部账目为 CSV
// 由 .github/workflows/backup.yml 定时调用，不属于前端代码（不走 src/lib/db.ts）
// CSV 列格式与 src/lib/export.ts 保持一致，改动需同步
import { createClient } from '@supabase/supabase-js'
import { writeFileSync } from 'node:fs'

const { SUPABASE_URL, SUPABASE_ANON_KEY, BACKUP_EMAIL, BACKUP_PASSWORD } = process.env
for (const k of ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'BACKUP_EMAIL', 'BACKUP_PASSWORD']) {
  if (!process.env[k]) {
    console.error(`缺少环境变量 ${k}`)
    process.exit(1)
  }
}
const outFile = process.argv[2] ?? 'backup.csv'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
})

const { error: authError } = await supabase.auth.signInWithPassword({
  email: BACKUP_EMAIL,
  password: BACKUP_PASSWORD,
})
if (authError) {
  console.error(`登录失败：${authError.message}`)
  process.exit(1)
}

const { data: categories, error: catError } = await supabase.from('categories').select('*')
if (catError) {
  console.error(`读取分类失败：${catError.message}`)
  process.exit(1)
}

// supabase 单次查询默认上限 1000 行，分页取全量
const txs = []
const PAGE = 1000
for (let from = 0; ; from += PAGE) {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .order('date')
    .order('created_at')
    .range(from, from + PAGE - 1)
  if (error) {
    console.error(`读取账目失败：${error.message}`)
    process.exit(1)
  }
  txs.push(...data)
  if (data.length < PAGE) break
}

function esc(field) {
  if (/[",\r\n]/.test(field)) return '"' + field.replace(/"/g, '""') + '"'
  return field
}

const catName = new Map(categories.map((c) => [c.id, c.name]))
const rows = [['日期', '类型', '分类', '金额', '描述', '备注']]
for (const t of txs) {
  rows.push([
    t.date,
    t.type === 'expense' ? '支出' : '收入',
    (t.category_id && catName.get(t.category_id)) || '未分类',
    Number(t.amount).toFixed(2),
    t.description,
    t.note,
  ])
}
const csv = '\uFEFF' + rows.map((r) => r.map(esc).join(',')).join('\r\n')
writeFileSync(outFile, csv)
console.log(`已导出 ${txs.length} 条账目到 ${outFile}`)

await supabase.auth.signOut()
