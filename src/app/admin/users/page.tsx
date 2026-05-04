'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'

type RoleFilter = 'all' | 'buyer' | 'seller' | 'admin'

export default function AdminUsersPage() {
  const router = useRouter()
  const [supabase] = useState(() => createClient())
  const [users, setUsers]   = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [role, setRole]       = useState<RoleFilter>('all')

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }
    const { data: profile } = await supabase.from('users').select('role').eq('auth_id', session.user.id).single()
    if (!profile || profile.role !== 'admin') { router.push('/'); return }
    await loadUsers(session.access_token)
  }

  async function loadUsers(token: string) {
    const res = await fetch('/api/admin/users', {
      headers: { authorization: `Bearer ${token}` },
    })
    const data = await res.json()
    if (res.ok) setUsers(data || [])
    setLoading(false)
  }

  const displayed = users.filter(u => {
    const q = search.toLowerCase()
    const matchSearch = !search
      || (u.name  ?? '').toLowerCase().includes(q)
      || (u.phone ?? '').includes(q)
    const matchRole = role === 'all' || u.role === role
    return matchSearch && matchRole
  })

  const countByRole = (r: RoleFilter) => r === 'all' ? users.length : users.filter(u => u.role === r).length

  const ROLE_BADGE: Record<string, string> = {
    buyer:  'bg-blue-100 text-blue-700',
    seller: 'bg-emerald-100 text-emerald-800',
    admin:  'bg-red-100 text-red-700',
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
    </div>
  )

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">Users</h1>
        <span className="text-xs text-muted-foreground">{users.length} total</span>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or phone…"
          className="pl-9"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Role filter tabs */}
      <div className="flex gap-1.5 bg-gray-100 rounded-xl p-1">
        {(['all', 'buyer', 'seller', 'admin'] as const).map(r => (
          <button
            key={r}
            onClick={() => setRole(r)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
              role === r ? 'bg-white text-emerald-800 shadow-sm' : 'text-muted-foreground'
            }`}
          >
            {r} ({countByRole(r)})
          </button>
        ))}
      </div>

      {/* Users list */}
      <div className="space-y-2.5">
        {displayed.length === 0 && (
          <p className="text-center text-muted-foreground py-12 text-sm">No users found</p>
        )}
        {displayed.map(u => {
          const joined = new Date(u.created_at).toLocaleDateString('en-IN', {
            day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata',
          })
          return (
            <div key={u.id} className="bg-white rounded-2xl border p-4">
              <div className="flex items-start gap-3">
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-base font-bold text-gray-500 flex-shrink-0">
                  {(u.name ?? '?')[0].toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold">{u.name ?? '—'}</p>
                    <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full capitalize ${ROLE_BADGE[u.role] ?? 'bg-gray-100 text-gray-500'}`}>
                      {u.role}
                    </span>
                  </div>
                  {u.phone && <p className="text-xs text-muted-foreground mt-0.5">{u.phone}</p>}
                  <p className="text-xs text-muted-foreground mt-1">Joined {joined}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
