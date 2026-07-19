-- 账目币种：存显示符号（与前端 Currency 类型一致），存量数据默认欧元
alter table public.transactions
  add column currency text not null default '€'
  check (currency in ('€', '¥'));
