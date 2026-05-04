'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { uploadImage, generateImagePath } from '@/lib/supabase/storage'
import { MenuItem, ItemGroup, PreorderWindow } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, ChevronDown, ChevronUp, Clock, Layers, Camera, X } from 'lucide-react'

export default function SellerListingsPage() {
  const [supabase] = useState(() => createClient())
  const [storeId, setStoreId] = useState<string | null>(null)
  const [groups, setGroups] = useState<ItemGroup[]>([])
  const [items, setItems] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

  // Item dialog state
  const [itemDialog, setItemDialog] = useState(false)
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null)
  const [itemForm, setItemForm] = useState<Partial<MenuItem>>({
    title: '', subtitle: '', price: 0, is_available: true,
    order_type: 'both', group_id: null, is_combo: false,
    available_from: null, available_until: null,
  })
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [preorderWindows, setPreorderWindows] = useState<PreorderWindow[]>([])

  // Group dialog state
  const [groupDialog, setGroupDialog] = useState(false)
  const [groupName, setGroupName] = useState('')
  const [editingGroup, setEditingGroup] = useState<ItemGroup | null>(null)

  useEffect(() => { loadStore() }, [])

  async function loadStore() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { window.location.href = '/login'; return }

    const { data: profile } = await supabase.from('users').select('id').eq('auth_id', user.id).single()
    if (!profile) { window.location.href = '/seller/onboarding'; return }

    const { data: store } = await supabase.from('stores').select('id').eq('owner_id', profile.id).single()
    if (!store) { window.location.href = '/seller/onboarding'; return }

    setStoreId(store.id)
    await loadData(store.id)
  }

  async function loadData(sid: string) {
    setLoading(true)
    const [{ data: g }, { data: i }] = await Promise.all([
      supabase.from('item_groups').select('*').eq('store_id', sid).order('sort_order'),
      supabase.from('menu_items').select('*').eq('store_id', sid).order('created_at'),
    ])
    setGroups(g || [])
    setItems(i || [])
    setLoading(false)
  }

  // ── Item CRUD ──────────────────────────────────────────────────────────────

  function openAddItem(groupId?: string) {
    setEditingItem(null)
    setItemForm({
      title: '', subtitle: '', price: 0, is_available: true,
      order_type: 'both', group_id: groupId || null, is_combo: false,
      available_from: null, available_until: null, delivery_time: null, image_url: null,
    })
    setImageFile(null)
    setImagePreview(null)
    setPreorderWindows([])
    setItemDialog(true)
  }

  function openEditItem(item: MenuItem) {
    setEditingItem(item)
    setItemForm({ ...item })
    setImageFile(null)
    setImagePreview(item.image_url)
    setPreorderWindows(item.preorder_windows || [])
    setItemDialog(true)
  }

  function addPreorderWindow() {
    setPreorderWindows(w => [...w, { order_open: '', order_close: '', delivery_time: '' }])
  }

  function updatePreorderWindow(idx: number, field: keyof PreorderWindow, value: string) {
    setPreorderWindows(w => w.map((win, i) => i === idx ? { ...win, [field]: value } : win))
  }

  function removePreorderWindow(idx: number) {
    setPreorderWindows(w => w.filter((_, i) => i !== idx))
  }

  function handleItemImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  async function saveItem() {
    if (!itemForm.title?.trim()) { toast.error('Title is required'); return }
    if (!itemForm.price || itemForm.price <= 0) { toast.error('Price must be greater than 0'); return }
    if (!storeId) return

    // Upload new image if selected
    let imageUrl = itemForm.image_url || null
    if (imageFile && storeId) {
      const uploaded = await uploadImage(imageFile, 'item-images', generateImagePath(`items/${storeId}`, imageFile.name))
      if (uploaded) imageUrl = uploaded
      else toast.error('Image upload failed — item will be saved without image')
    }

    const payload = {
      store_id: storeId,
      title: itemForm.title!.trim(),
      subtitle: itemForm.subtitle?.trim() || null,
      price: itemForm.price,
      is_available: itemForm.is_available ?? true,
      order_type: itemForm.order_type || 'both',
      group_id: itemForm.group_id || null,
      is_combo: itemForm.is_combo || false,
      available_from: itemForm.available_from || null,
      available_until: itemForm.available_until || null,
      delivery_time: null,
      preorder_windows: preorderWindows.filter(w => w.order_open && w.order_close && w.delivery_time),
      image_url: imageUrl,
    }

    if (editingItem) {
      const { error } = await supabase.from('menu_items').update(payload).eq('id', editingItem.id)
      if (error) { toast.error('Failed to update item'); return }
      toast.success('Item updated')
    } else {
      const { error } = await supabase.from('menu_items').insert(payload)
      if (error) { toast.error('Failed to add item'); return }
      toast.success('Item added')
    }
    setItemDialog(false)
    loadData(storeId)
  }

  async function deleteItem(id: string) {
    if (!confirm('Delete this item?')) return
    await supabase.from('menu_items').delete().eq('id', id)
    toast.success('Item deleted')
    loadData(storeId!)
  }

  async function toggleItem(id: string, current: boolean) {
    await supabase.from('menu_items').update({ is_available: !current }).eq('id', id)
    setItems(prev => prev.map(i => i.id === id ? { ...i, is_available: !current } : i))
  }

  // ── Group CRUD ─────────────────────────────────────────────────────────────

  function openAddGroup() {
    setEditingGroup(null)
    setGroupName('')
    setGroupDialog(true)
  }

  function openEditGroup(g: ItemGroup) {
    setEditingGroup(g)
    setGroupName(g.name)
    setGroupDialog(true)
  }

  async function saveGroup() {
    if (!groupName.trim()) { toast.error('Group name required'); return }
    if (!storeId) return

    if (editingGroup) {
      await supabase.from('item_groups').update({ name: groupName.trim() }).eq('id', editingGroup.id)
      toast.success('Group renamed')
    } else {
      await supabase.from('item_groups').insert({ store_id: storeId, name: groupName.trim(), sort_order: groups.length })
      toast.success('Group created')
    }
    setGroupDialog(false)
    loadData(storeId)
  }

  async function deleteGroup(id: string) {
    if (!confirm('Delete group? Items in this group will become ungrouped.')) return
    await supabase.from('item_groups').delete().eq('id', id)
    toast.success('Group deleted')
    loadData(storeId!)
  }

  async function moveGroup(id: string, direction: 'up' | 'down') {
    const idx = groups.findIndex(g => g.id === id)
    if (direction === 'up' && idx === 0) return
    if (direction === 'down' && idx === groups.length - 1) return

    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    const updated = [...groups]
    ;[updated[idx], updated[swapIdx]] = [updated[swapIdx], updated[idx]]

    await Promise.all([
      supabase.from('item_groups').update({ sort_order: swapIdx }).eq('id', updated[swapIdx].id),
      supabase.from('item_groups').update({ sort_order: idx }).eq('id', updated[idx].id),
    ])
    setGroups(updated.map((g, i) => ({ ...g, sort_order: i })))
  }

  function toggleGroupCollapse(id: string) {
    setCollapsedGroups(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const ungroupedItems = items.filter(i => !i.group_id)

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-muted-foreground">Loading menu…</div>
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto p-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Menu</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={openAddGroup}>
            <Layers className="w-4 h-4 mr-1" /> Group
          </Button>
          <Button size="sm" className="bg-emerald-700 hover:bg-emerald-800" onClick={() => openAddItem()}>
            <Plus className="w-4 h-4 mr-1" /> Item
          </Button>
        </div>
      </div>

      {/* Ungrouped items */}
      {ungroupedItems.length > 0 && (
        <div className="mb-6">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Ungrouped</p>
          <div className="space-y-2">
            {ungroupedItems.map(item => (
              <ItemCard key={item.id} item={item} onEdit={openEditItem} onDelete={deleteItem} onToggle={toggleItem} />
            ))}
          </div>
        </div>
      )}

      {/* Groups */}
      {groups.map((group, idx) => {
        const groupItems = items.filter(i => i.group_id === group.id)
        const collapsed = collapsedGroups.has(group.id)
        return (
          <div key={group.id} className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <button
                className="flex items-center gap-2 font-semibold text-sm uppercase tracking-wide text-emerald-800"
                onClick={() => toggleGroupCollapse(group.id)}
              >
                {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                {group.name}
                <Badge variant="secondary" className="text-xs">{groupItems.length}</Badge>
              </button>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveGroup(group.id, 'up')} disabled={idx === 0}>
                  <ChevronUp className="w-3 h-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveGroup(group.id, 'down')} disabled={idx === groups.length - 1}>
                  <ChevronDown className="w-3 h-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditGroup(group)}>
                  <Pencil className="w-3 h-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteGroup(group.id)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-700" onClick={() => openAddItem(group.id)}>
                  <Plus className="w-3 h-3" />
                </Button>
              </div>
            </div>
            {!collapsed && (
              <div className="space-y-2">
                {groupItems.length === 0 ? (
                  <p className="text-xs text-muted-foreground pl-2">No items yet. <button className="text-emerald-700 underline" onClick={() => openAddItem(group.id)}>Add one</button></p>
                ) : (
                  groupItems.map(item => (
                    <ItemCard key={item.id} item={item} onEdit={openEditItem} onDelete={deleteItem} onToggle={toggleItem} />
                  ))
                )}
              </div>
            )}
          </div>
        )
      })}

      {items.length === 0 && groups.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <div className="text-4xl mb-3">🍽️</div>
          <p className="font-medium">Your menu is empty</p>
          <p className="text-sm mt-1">Add your first item to get started</p>
          <Button className="mt-4 bg-emerald-700 hover:bg-emerald-800" onClick={() => openAddItem()}>
            <Plus className="w-4 h-4 mr-1" /> Add Item
          </Button>
        </div>
      )}

      {/* Item Dialog */}
      <Dialog open={itemDialog} onOpenChange={setItemDialog}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Item' : 'Add Item'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">

            {/* Item image */}
            <div className="flex items-center gap-4">
              <label htmlFor="item-img" className="cursor-pointer flex-shrink-0">
                <div className="w-20 h-20 rounded-xl border-2 border-dashed border-emerald-200 overflow-hidden flex items-center justify-center bg-emerald-50 hover:border-emerald-500 transition-colors">
                  {imagePreview
                    ? <img src={imagePreview} alt="preview" className="w-full h-full object-cover" />
                    : <div className="text-center"><Camera className="w-5 h-5 mx-auto text-emerald-300" /><p className="text-xs text-muted-foreground mt-1">Add photo</p></div>
                  }
                </div>
              </label>
              <input id="item-img" type="file" accept="image/*" className="hidden" onChange={handleItemImageChange} />
              <div>
                <p className="text-sm font-medium">Item Photo</p>
                <p className="text-xs text-muted-foreground">Recommended. Tap to {imagePreview ? 'change' : 'upload'}.</p>
                {imagePreview && (
                  <button className="text-xs text-destructive mt-1 underline" onClick={() => { setImageFile(null); setImagePreview(null); setItemForm(f => ({ ...f, image_url: null })) }}>
                    Remove
                  </button>
                )}
              </div>
            </div>

            <Separator />

            <div className="space-y-1">
              <Label>Title <span className="text-destructive">*</span></Label>
              <Input placeholder="e.g. Dal Makhani" value={itemForm.title || ''} onChange={e => setItemForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Subtitle / Description</Label>
              <Textarea placeholder="e.g. Slow-cooked overnight, served with butter" value={itemForm.subtitle || ''} onChange={e => setItemForm(f => ({ ...f, subtitle: e.target.value }))} rows={2} />
            </div>
            <div className="space-y-1">
              <Label>Price (₹) <span className="text-destructive">*</span></Label>
              <Input type="number" min={0} placeholder="0" value={itemForm.price || ''} onChange={e => setItemForm(f => ({ ...f, price: parseFloat(e.target.value) || 0 }))} />
            </div>
            <div className="space-y-1">
              <Label>Group</Label>
              <Select value={itemForm.group_id || 'none'} onValueChange={v => setItemForm(f => ({ ...f, group_id: v === 'none' ? null : v }))}>
                <SelectTrigger><SelectValue placeholder="No group" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No group</SelectItem>
                  {groups.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Order Type</Label>
              <Select value={itemForm.order_type || 'both'} onValueChange={v => setItemForm(f => ({ ...f, order_type: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="both">Spot & Pre-order</SelectItem>
                  <SelectItem value="spot">Spot only</SelectItem>
                  <SelectItem value="preorder">Pre-order only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Separator />

            {/* Spot order timing */}
            {(itemForm.order_type === 'spot' || itemForm.order_type === 'both') && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><Clock className="w-4 h-4" /> Spot Order Window</Label>
                <p className="text-xs text-muted-foreground">When customers can see and order this item for immediate delivery.</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">Available from</Label>
                    <Input type="time" value={itemForm.available_from || ''} onChange={e => setItemForm(f => ({ ...f, available_from: e.target.value || null }))} />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Available until</Label>
                    <Input type="time" value={itemForm.available_until || ''} onChange={e => setItemForm(f => ({ ...f, available_until: e.target.value || null }))} />
                  </div>
                </div>
              </div>
            )}

            {/* Pre-order windows */}
            {(itemForm.order_type === 'preorder' || itemForm.order_type === 'both') && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2"><Clock className="w-4 h-4" /> Pre-order Windows</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addPreorderWindow}>
                    <Plus className="w-3 h-3 mr-1" /> Add Window
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Each window defines when customers can order and when they'll receive it.</p>

                {preorderWindows.length === 0 && (
                  <div className="text-center py-4 border-2 border-dashed rounded-xl text-sm text-muted-foreground">
                    No windows yet. Click "Add Window" to create one.
                  </div>
                )}

                {preorderWindows.map((win, idx) => (
                  <div key={idx} className="border rounded-xl p-3 space-y-2 bg-emerald-50/50">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-emerald-800">Window {idx + 1}</span>
                      <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removePreorderWindow(idx)}>
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Ordering slot — customers can order between:</Label>
                      <div className="grid grid-cols-2 gap-2 mt-1">
                        <div>
                          <Label className="text-xs text-muted-foreground">Opens at</Label>
                          <Input type="time" value={win.order_open} onChange={e => updatePreorderWindow(idx, 'order_open', e.target.value)} />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Closes at</Label>
                          <Input type="time" value={win.order_close} onChange={e => updatePreorderWindow(idx, 'order_close', e.target.value)} />
                        </div>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Delivery time</Label>
                      <Input type="time" value={win.delivery_time} onChange={e => updatePreorderWindow(idx, 'delivery_time', e.target.value)} />
                    </div>
                  </div>
                ))}
              </div>
            )}
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <Label>This is a Combo</Label>
                <p className="text-xs text-muted-foreground">Bundle multiple items together</p>
              </div>
              <Switch checked={itemForm.is_combo || false} onCheckedChange={v => setItemForm(f => ({ ...f, is_combo: v }))} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Available</Label>
              <Switch checked={itemForm.is_available ?? true} onCheckedChange={v => setItemForm(f => ({ ...f, is_available: v }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setItemDialog(false)}>Cancel</Button>
            <Button className="bg-emerald-700 hover:bg-emerald-800" onClick={saveItem}>
              {editingItem ? 'Save Changes' : 'Add Item'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Group Dialog */}
      <Dialog open={groupDialog} onOpenChange={setGroupDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingGroup ? 'Rename Group' : 'Add Group'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Group Name</Label>
            <Input placeholder="e.g. Breakfast, Main Course, Snacks" value={groupName} onChange={e => setGroupName(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveGroup()} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGroupDialog(false)}>Cancel</Button>
            <Button className="bg-emerald-700 hover:bg-emerald-800" onClick={saveGroup}>
              {editingGroup ? 'Rename' : 'Create Group'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Item Card ────────────────────────────────────────────────────────────────
function ItemCard({ item, onEdit, onDelete, onToggle }: {
  item: MenuItem
  onEdit: (item: MenuItem) => void
  onDelete: (id: string) => void
  onToggle: (id: string, current: boolean) => void
}) {
  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl border bg-white ${!item.is_available ? 'opacity-50' : ''}`}>
      {item.image_url && (
        <img src={item.image_url} alt={item.title} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">{item.title}</span>
          {item.is_combo && <Badge variant="secondary" className="text-xs">Combo</Badge>}
          {item.order_type !== 'both' && (
            <Badge variant="outline" className="text-xs capitalize">{item.order_type}</Badge>
          )}
        </div>
        {item.subtitle && <p className="text-xs text-muted-foreground truncate mt-0.5">{item.subtitle}</p>}
        <div className="flex items-center gap-2 mt-1">
          <p className="text-sm font-semibold text-emerald-800">₹{item.price}</p>
          {item.preorder_windows?.length > 0 && (
            <span className="text-xs text-muted-foreground flex items-center gap-0.5">
              <Clock className="w-3 h-3" /> {item.preorder_windows.length} pre-order {item.preorder_windows.length === 1 ? 'window' : 'windows'}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <Switch checked={item.is_available} onCheckedChange={() => onToggle(item.id, item.is_available)} />
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(item)}>
          <Pencil className="w-3.5 h-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => onDelete(item.id)}>
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  )
}
