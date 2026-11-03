'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Edit2, Trash2, Check, X, Search } from 'lucide-react'

interface MasterItem {
  id: string
  name: string
  created_at: string
}

interface MasterListManagerProps {
  tableName: 'work_types' | 'expense_categories' | 'payment_modes'
  title: string
  description: string
  placeholder: string
  businessId: string
  helpText?: string
}

export default function MasterListManager({
  tableName,
  title,
  description,
  placeholder,
  businessId,
  helpText,
}: MasterListManagerProps) {
  const [items, setItems] = useState<MasterItem[]>([])
  const [loading, setLoading] = useState(true)
  const [newItemName, setNewItemName] = useState('')
  const [adding, setAdding] = useState(false)
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const supabase = createClient()

  const loadItems = useCallback(async () => {
    setLoading(true)
    const { data, error: err } = await supabase
      .from(tableName)
      .select('id, name, created_at')
      .eq('business_id', businessId)
      .order('name', { ascending: true })

    if (err) {
      setError(err.message)
    } else {
      setItems(data || [])
    }
    setLoading(false)
  }, [businessId, supabase, tableName])

  useEffect(() => {
    if (businessId) {
      loadItems()
    }
  }, [businessId, loadItems])

  const showNotification = (msg: string, isError = false) => {
    if (isError) {
      setError(msg)
      setTimeout(() => setError(null), 3500)
    } else {
      setSuccess(msg)
      setTimeout(() => setSuccess(null), 3000)
    }
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = newItemName.trim()
    if (!trimmed) return

    // Check duplicate locally
    if (items.some((item) => item.name.toLowerCase() === trimmed.toLowerCase())) {
      showNotification(`"${trimmed}" already exists.`, true)
      return
    }

    setAdding(true)
    const { data, error: err } = await supabase
      .from(tableName)
      .insert({
        business_id: businessId,
        name: trimmed,
      })
      .select('id, name, created_at')
      .single()

    setAdding(false)

    if (err) {
      showNotification(err.message, true)
    } else if (data) {
      setItems((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
      setNewItemName('')
      showNotification(`"${trimmed}" added successfully!`)
    }
  }

  const startEdit = (item: MasterItem) => {
    setEditingId(item.id)
    setEditingName(item.name)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditingName('')
  }

  const handleUpdate = async (id: string) => {
    const trimmed = editingName.trim()
    if (!trimmed) return

    // Check duplicate
    if (items.some((item) => item.id !== id && item.name.toLowerCase() === trimmed.toLowerCase())) {
      showNotification(`"${trimmed}" already exists.`, true)
      return
    }

    const { error: err } = await supabase
      .from(tableName)
      .update({ name: trimmed })
      .eq('id', id)

    if (err) {
      showNotification(err.message, true)
    } else {
      setItems((prev) =>
        prev
          .map((item) => (item.id === id ? { ...item, name: trimmed } : item))
          .sort((a, b) => a.name.localeCompare(b.name))
      )
      setEditingId(null)
      showNotification('Updated successfully!')
    }
  }

  const handleDelete = async (item: MasterItem) => {
    const confirmDelete = window.confirm(`Are you sure you want to delete "${item.name}"?`)
    if (!confirmDelete) return

    const { error: err } = await supabase.from(tableName).delete().eq('id', item.id)

    if (err) {
      showNotification(`Cannot delete: ${err.message}`, true)
    } else {
      setItems((prev) => prev.filter((i) => i.id !== item.id))
      showNotification(`"${item.name}" removed.`)
    }
  }

  const filteredItems = items.filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <Card className="shadow-sm border-gray-200">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <CardTitle className="text-lg font-semibold text-gray-900">{title}</CardTitle>
            <CardDescription className="text-sm text-gray-500 mt-1">{description}</CardDescription>
          </div>
          <span className="text-xs font-medium px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-full w-fit">
            {items.length} {items.length === 1 ? 'item' : 'items'}
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Alerts */}
        {error && (
          <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md">
            {error}
          </div>
        )}
        {success && (
          <div className="p-3 text-sm text-green-700 bg-green-50 border border-green-200 rounded-md">
            ✓ {success}
          </div>
        )}

        {/* Add New Form */}
        <form onSubmit={handleAdd} className="flex gap-2">
          <Input
            placeholder={placeholder}
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            className="flex-1"
            disabled={adding}
          />
          <Button type="submit" isLoading={adding} disabled={!newItemName.trim()}>
            <Plus className="w-4 h-4 mr-1.5" />
            Add
          </Button>
        </form>
        {helpText && <p className="text-xs text-gray-400">{helpText}</p>}

        {/* Search filter if items > 5 */}
        {items.length > 5 && (
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder={`Search ${title.toLowerCase()}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>
        )}

        {/* Items List */}
        {loading ? (
          <div className="py-8 text-center text-gray-400 text-sm">
            <div className="animate-spin h-6 w-6 border-2 border-indigo-600 border-t-transparent rounded-full mx-auto mb-2" />
            Loading {title.toLowerCase()}...
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-8 text-center text-gray-400 text-sm border-2 border-dashed border-gray-100 rounded-lg">
            {search ? 'No matching items found.' : `No ${title.toLowerCase()} added yet.`}
          </div>
        ) : (
          <div className="divide-y divide-gray-100 border border-gray-100 rounded-lg overflow-hidden">
            {filteredItems.map((item) => {
              const isEditing = editingId === item.id
              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between px-4 py-2.5 bg-white hover:bg-gray-50 transition-colors"
                >
                  {isEditing ? (
                    <div className="flex items-center gap-2 flex-1 mr-2">
                      <Input
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        className="h-8 text-sm"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleUpdate(item.id)
                          if (e.key === 'Escape') cancelEdit()
                        }}
                      />
                      <Button
                        size="sm"
                        variant="default"
                        className="h-8 px-2"
                        onClick={() => handleUpdate(item.id)}
                      >
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2"
                        onClick={cancelEdit}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <span className="font-medium text-sm text-gray-800">{item.name}</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => startEdit(item)}
                          className="p-1.5 text-gray-400 hover:text-indigo-600 rounded hover:bg-gray-100 transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(item)}
                          className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-gray-100 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
