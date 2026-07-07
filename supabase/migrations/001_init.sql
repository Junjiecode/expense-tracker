-- 记账本初始建表
-- 在 Supabase Dashboard → SQL Editor 里整段执行一次即可

-- 分类
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  icon text not null default '📝',
  color text not null default '#8A8A82',
  type text not null default 'expense' check (type in ('expense', 'income')),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- 交易流水（amount 始终为正，方向看 type）
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null default current_date,
  amount numeric(12,2) not null check (amount >= 0),
  type text not null default 'expense' check (type in ('expense', 'income')),
  description text not null default '',
  category_id uuid references public.categories(id) on delete set null,
  note text not null default '',
  source text not null default 'manual' check (source in ('manual', 'csv')),
  import_hash text,
  created_at timestamptz not null default now()
);

-- CSV 导入去重：同一用户同一 hash 只能有一条
create unique index transactions_import_dedup
  on public.transactions (user_id, import_hash)
  where import_hash is not null;

create index transactions_user_date on public.transactions (user_id, date desc);

-- CSV 自动分类规则：描述里包含 keyword 就归到 category
create table public.category_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  keyword text not null,
  category_id uuid not null references public.categories(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- 行级安全：每个人只能读写自己的数据
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.category_rules enable row level security;

create policy "own categories" on public.categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own transactions" on public.transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rules" on public.category_rules
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 新用户注册时自动创建默认分类
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.categories (user_id, name, icon, color, type, sort_order) values
    -- 颜色为经过色觉安全校验的分类色板（dataviz palette）
    (new.id, '餐饮', '🍜', '#EB6834', 'expense', 1),
    (new.id, '交通', '🚇', '#2A78D6', 'expense', 2),
    (new.id, '购物', '🛍️', '#E87BA4', 'expense', 3),
    (new.id, '日用', '🧺', '#1BAF7A', 'expense', 4),
    (new.id, '居住', '🏠', '#4A3AA7', 'expense', 5),
    (new.id, '娱乐', '🎮', '#EDA100', 'expense', 6),
    (new.id, '医疗', '💊', '#E34948', 'expense', 7),
    (new.id, '订阅', '📱', '#008300', 'expense', 8),
    (new.id, '其他', '📝', '#8A8A82', 'expense', 9),
    (new.id, '工资', '💰', '#2E7D5B', 'income', 10),
    (new.id, '其他收入', '🪙', '#199E70', 'income', 11);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
