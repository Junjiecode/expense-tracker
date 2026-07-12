-- v1.4 固定收支模板
-- 在 Supabase Dashboard → SQL Editor 手动执行；先于本次代码部署
-- 记入的账目仍是普通 manual 账目，靠 transactions.import_hash = 'rec:{item_id}:{YYYY-MM}'
-- 配合已有的 (user_id, import_hash) 唯一部分索引做同月幂等，transactions 表无需改动

create table public.recurring_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  amount numeric(12,2) not null check (amount >= 0),
  type text not null check (type in ('expense', 'income')),
  category_id uuid references public.categories(id) on delete set null,
  note text not null default '',
  day_of_month int not null default 1 check (day_of_month between 1 and 31),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.recurring_items enable row level security;
create policy "own recurring_items" on public.recurring_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
