-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Users
create table public.users (
  id uuid primary key default uuid_generate_v4(),
  auth_id uuid unique references auth.users(id) on delete cascade,
  name text not null,
  phone text unique not null,
  role text not null default 'buyer' check (role in ('buyer', 'seller', 'admin')),
  created_at timestamptz default now()
);

-- Stores / Kitchens
create table public.stores (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  description text,
  image_url text,
  is_active boolean default true,
  commission_pct numeric(5,2) default 10.00,
  open_from time,
  open_until time,
  created_at timestamptz default now()
);

-- Item Groups (Breakfast, Main Course, etc.)
create table public.item_groups (
  id uuid primary key default uuid_generate_v4(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  sort_order integer default 0,
  created_at timestamptz default now()
);

-- Menu Items (including combos)
create table public.menu_items (
  id uuid primary key default uuid_generate_v4(),
  store_id uuid not null references public.stores(id) on delete cascade,
  group_id uuid references public.item_groups(id) on delete set null,
  title text not null,
  subtitle text,
  image_url text,
  price numeric(10,2) not null,
  is_available boolean default true,
  order_type text not null default 'both' check (order_type in ('spot', 'preorder', 'both')),
  available_from time,
  available_until time,
  is_combo boolean default false,
  combo_items jsonb,
  created_at timestamptz default now()
);

-- Orders
create table public.orders (
  id uuid primary key default uuid_generate_v4(),
  store_id uuid not null references public.stores(id),
  buyer_id uuid not null references public.users(id),
  status text not null default 'created' check (
    status in ('created','accepted','waiting_payment','payment_confirmed','dispatched','delivered','rejected','cancelled','payment_failed')
  ),
  order_type text not null check (order_type in ('spot', 'preorder')),
  total numeric(10,2) not null,
  eta_minutes integer,
  created_at timestamptz default now()
);

-- Order Items
create table public.order_items (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references public.orders(id) on delete cascade,
  item_id uuid references public.menu_items(id) on delete set null,
  title text not null,
  quantity integer not null default 1,
  price numeric(10,2) not null
);

-- Payments
create table public.payments (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null unique references public.orders(id),
  razorpay_order_id text,
  razorpay_payment_id text,
  amount numeric(10,2) not null,
  status text not null default 'pending' check (status in ('pending','paid','failed','refunded')),
  settled_at timestamptz,
  created_at timestamptz default now()
);

-- Reviews
create table public.reviews (
  id uuid primary key default uuid_generate_v4(),
  store_id uuid not null references public.stores(id),
  order_id uuid not null unique references public.orders(id),
  buyer_id uuid not null references public.users(id),
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz default now()
);

-- Row Level Security
alter table public.users enable row level security;
alter table public.stores enable row level security;
alter table public.item_groups enable row level security;
alter table public.menu_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.reviews enable row level security;

-- RLS Policies: users
create policy "Users can read own profile" on public.users for select using (auth.uid() = auth_id);
create policy "Users can update own profile" on public.users for update using (auth.uid() = auth_id);
create policy "Public can read user names" on public.users for select using (true);

-- RLS Policies: stores
create policy "Anyone can read active stores" on public.stores for select using (is_active = true);
create policy "Sellers can manage own store" on public.stores for all using (
  owner_id = (select id from public.users where auth_id = auth.uid())
);

-- RLS Policies: item_groups
create policy "Anyone can read item groups" on public.item_groups for select using (true);
create policy "Sellers can manage own item groups" on public.item_groups for all using (
  store_id in (select id from public.stores where owner_id = (select id from public.users where auth_id = auth.uid()))
);

-- RLS Policies: menu_items
create policy "Anyone can read menu items" on public.menu_items for select using (true);
create policy "Sellers can manage own menu items" on public.menu_items for all using (
  store_id in (select id from public.stores where owner_id = (select id from public.users where auth_id = auth.uid()))
);

-- RLS Policies: orders
create policy "Buyers can read own orders" on public.orders for select using (
  buyer_id = (select id from public.users where auth_id = auth.uid())
);
create policy "Sellers can read store orders" on public.orders for select using (
  store_id in (select id from public.stores where owner_id = (select id from public.users where auth_id = auth.uid()))
);
create policy "Buyers can create orders" on public.orders for insert with check (
  buyer_id = (select id from public.users where auth_id = auth.uid())
);
create policy "Sellers can update order status" on public.orders for update using (
  store_id in (select id from public.stores where owner_id = (select id from public.users where auth_id = auth.uid()))
);

-- RLS Policies: order_items
create policy "Order participants can read items" on public.order_items for select using (
  order_id in (
    select id from public.orders where
      buyer_id = (select id from public.users where auth_id = auth.uid()) or
      store_id in (select id from public.stores where owner_id = (select id from public.users where auth_id = auth.uid()))
  )
);
create policy "Buyers can insert order items" on public.order_items for insert with check (
  order_id in (select id from public.orders where buyer_id = (select id from public.users where auth_id = auth.uid()))
);

-- RLS Policies: payments
create policy "Order participants can read payments" on public.payments for select using (
  order_id in (
    select id from public.orders where
      buyer_id = (select id from public.users where auth_id = auth.uid()) or
      store_id in (select id from public.stores where owner_id = (select id from public.users where auth_id = auth.uid()))
  )
);

-- RLS Policies: reviews
create policy "Anyone can read reviews" on public.reviews for select using (true);
create policy "Buyers can write reviews for own orders" on public.reviews for insert with check (
  buyer_id = (select id from public.users where auth_id = auth.uid())
);
