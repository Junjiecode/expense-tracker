-- 002：category_rules 去重 + (user_id, keyword) 唯一约束
-- 在 Supabase Dashboard → SQL Editor 手动执行；必须先于 v1.3 代码部署（saveRule 的 upsert 依赖此约束）

-- 1) 清理历史重复：同 (user_id, keyword) 只保留最新一条（后存的规则代表用户最新意图）
delete from public.category_rules a
using public.category_rules b
where a.user_id = b.user_id
  and a.keyword = b.keyword
  and (a.created_at, a.id) < (b.created_at, b.id);

-- 2) 唯一约束（saveRule upsert 的 onConflict 目标）
alter table public.category_rules
  add constraint category_rules_user_keyword_key unique (user_id, keyword);
