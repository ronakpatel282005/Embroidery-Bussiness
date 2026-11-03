'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Modal from '@/components/ui/modal'
import FormattedNumberInput from '@/components/ui/formatted-number-input'
import { formatCurrency, formatDate } from '@/lib/utils'
import {
  ShoppingBag,
  Plus,
  Search,
  Phone,
  MessageCircle,
  Edit2,
  Trash2,
  TrendingDown,
  Receipt,
  Building2,
  CheckCircle2,
  Calendar,
  Layers,
} from 'lucide-react'

export interface MaterialShop {
  id: string
  name: string
  contact_person: string
  phone: string
  category: 'Threads & Zari' | 'Needles & Machine Spares' | 'Canvas & Backing' | 'Sequins & Beads' | 'Oil & Lubricants' | 'General'
  address?: string
  total_billed: number
  total_paid: number
  outstanding_balance: number
}

export interface MaterialPurchase {
  id: string
  shop_id: string
  shop_name: string
  bill_number: string
  bill_date: string
  category: string
  items_summary: string
  amount: number
  paid_amount: number
  balance: number
}

const DEFAULT_SHOPS: MaterialShop[] = [
  {
    id: 'ms-1',
    name: 'Surat Zari & Thread Mart',
    contact_person: 'Pankaj Bhai',
    phone: '9825198251',
    category: 'Threads & Zari',
    address: 'Ring Road Textile Market, Surat',
    total_billed: 45000,
    total_paid: 30000,
    outstanding_balance: 15000,
  },
  {
    id: 'ms-2',
    name: 'Khatodara Needles & Spares',
    contact_person: 'Jagdish Patel',
    phone: '9898123456',
    category: 'Needles & Machine Spares',
    address: 'Plot 18, Khatodara GIDC, Surat',
    total_billed: 18500,
    total_paid: 18500,
    outstanding_balance: 0,
  },
  {
    id: 'ms-3',
    name: 'Shree Ram Canvas & Backing Paper',
    contact_person: 'Rameshwar Sharma',
    phone: '9724012345',
    category: 'Canvas & Backing',
    address: 'Udhna GIDC, Surat',
    total_billed: 28000,
    total_paid: 15000,
    outstanding_balance: 13000,
  },
]

export default function MaterialShopsPage() {
  const supabase = createClient()

  const [shops, setShops] = useState<MaterialShop[]>([])
  const [purchases, setPurchases] = useState<MaterialPurchase[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [activeTab, setActiveTab] = useState<'shops' | 'bills'>('shops')

  // Modals
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [editingShop, setEditingShop] = useState<MaterialShop | null>(null)
  const [payingShop, setPayingShop] = useState<MaterialShop | null>(null)
  const [isPurchaseOpen, setIsPurchaseOpen] = useState(false)

  // Form states for Shop Add/Edit
  const [name, setName] = useState('')
  const [contactPerson, setContactPerson] = useState('')
  const [phone, setPhone] = useState('')
  const [category, setCategory] = useState<MaterialShop['category']>('Threads & Zari')
  const [address, setAddress] = useState('')
  const [openingBalance, setOpeningBalance] = useState<number | string>(0)

  // Form states for Record Purchase Bill
  const [selectedShopId, setSelectedShopId] = useState('')
  const [billNumber, setBillNumber] = useState('')
  const [billDate, setBillDate] = useState(new Date().toISOString().split('T')[0])
  const [purchaseCategory, setPurchaseCategory] = useState('Threads & Zari')
  const [itemsSummary, setItemsSummary] = useState('')
  const [billAmount, setBillAmount] = useState<number | string>('')
  const [paidNow, setPaidNow] = useState<number | string>(0)

  // Form states for Pay Shop
  const [payAmount, setPayAmount] = useState<number | string>('')
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0])
  const [payMode, setPayMode] = useState('Cash')
  const [payNotes, setPayNotes] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)

    const savedShops = localStorage.getItem('embroidery_material_shops')
    if (savedShops) {
      try {
        setShops(JSON.parse(savedShops))
      } catch {
        setShops(DEFAULT_SHOPS)
      }
    } else {
      setShops(DEFAULT_SHOPS)
      localStorage.setItem('embroidery_material_shops', JSON.stringify(DEFAULT_SHOPS))
    }

    const savedPurchases = localStorage.getItem('embroidery_material_purchases')
    if (savedPurchases) {
      try {
        setPurchases(JSON.parse(savedPurchases))
      } catch {
        setPurchases([])
      }
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const saveShops = (updated: MaterialShop[]) => {
    setShops(updated)
    localStorage.setItem('embroidery_material_shops', JSON.stringify(updated))
  }

  const savePurchases = (updated: MaterialPurchase[]) => {
    setPurchases(updated)
    localStorage.setItem('embroidery_material_purchases', JSON.stringify(updated))
  }

  const handleOpenAdd = () => {
    setName('')
    setContactPerson('')
    setPhone('')
    setCategory('Threads & Zari')
    setAddress('')
    setOpeningBalance(0)
    setIsAddOpen(true)
  }

  const handleOpenEdit = (s: MaterialShop) => {
    setEditingShop(s)
    setName(s.name)
    setContactPerson(s.contact_person)
    setPhone(s.phone)
    setCategory(s.category)
    setAddress(s.address || '')
    setOpeningBalance(0)
  }

  const handleSaveShop = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    if (editingShop) {
      const updated = shops.map((s) =>
        s.id === editingShop.id
          ? {
              ...s,
              name: name.trim(),
              contact_person: contactPerson.trim(),
              phone: phone.trim(),
              category,
              address: address.trim() || undefined,
            }
          : s
      )
      saveShops(updated)
      setEditingShop(null)
    } else {
      const openBal = Number(openingBalance) || 0
      const newShop: MaterialShop = {
        id: 'ms-' + Date.now(),
        name: name.trim(),
        contact_person: contactPerson.trim(),
        phone: phone.trim(),
        category,
        address: address.trim() || undefined,
        total_billed: openBal,
        total_paid: 0,
        outstanding_balance: openBal,
      }
      saveShops([...shops, newShop])
      setIsAddOpen(false)
    }
  }

  const handleDeleteShop = (s: MaterialShop) => {
    const confirmed = window.confirm(`Remove material shop "${s.name}"?`)
    if (!confirmed) return
    const updated = shops.filter((item) => item.id !== s.id)
    saveShops(updated)
  }

  const handleSavePurchase = (e: React.FormEvent) => {
    e.preventDefault()
    const targetShop = shops.find((s) => s.id === selectedShopId)
    if (!targetShop) return

    const total = Number(billAmount) || 0
    const paid = Number(paidNow) || 0
    const bal = Math.max(0, total - paid)

    const newPurchase: MaterialPurchase = {
      id: 'pur-' + Date.now(),
      shop_id: targetShop.id,
      shop_name: targetShop.name,
      bill_number: billNumber.trim() || 'CASH-BILL',
      bill_date: billDate,
      category: purchaseCategory,
      items_summary: itemsSummary.trim() || purchaseCategory,
      amount: total,
      paid_amount: paid,
      balance: bal,
    }

    // Update shop balance
    const updatedShops = shops.map((s) =>
      s.id === targetShop.id
        ? {
            ...s,
            total_billed: s.total_billed + total,
            total_paid: s.total_paid + paid,
            outstanding_balance: s.outstanding_balance + bal,
          }
        : s
    )

    saveShops(updatedShops)
    savePurchases([newPurchase, ...purchases])
    setIsPurchaseOpen(false)
  }

  const handleSavePayment = (e: React.FormEvent) => {
    e.preventDefault()
    if (!payingShop) return

    const amt = Number(payAmount) || 0
    if (amt <= 0) return

    const updatedShops = shops.map((s) =>
      s.id === payingShop.id
        ? {
            ...s,
            total_paid: s.total_paid + amt,
            outstanding_balance: Math.max(0, s.outstanding_balance - amt),
          }
        : s
    )

    saveShops(updatedShops)
    setPayingShop(null)
  }

  // Filtered shops
  const filteredShops = shops.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.contact_person.toLowerCase().includes(search.toLowerCase()) ||
      s.phone.includes(search)

    const matchesCat = categoryFilter === 'all' || s.category === categoryFilter

    return matchesSearch && matchesCat
  })

  // KPIs
  const totalBilledAll = shops.reduce((sum, s) => sum + s.total_billed, 0)
  const totalPaidAll = shops.reduce((sum, s) => sum + s.total_paid, 0)
  const totalOutstandingAll = shops.reduce((sum, s) => sum + s.outstanding_balance, 0)

  return (
    <div className="p-8 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ShoppingBag className="w-6 h-6 text-indigo-600" />
            Raw Material Shops & Spares
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            Manage your vendors for threads, zari, canvas, needles, sequins, and track supplier payables.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => {
              if (shops.length > 0 && !selectedShopId) {
                setSelectedShopId(shops[0].id)
              }
              setBillAmount('')
              setPaidNow(0)
              setBillNumber('')
              setItemsSummary('')
              setIsPurchaseOpen(true)
            }}
            className="shadow-xs"
          >
            <Receipt className="w-4 h-4 mr-1.5" />
            Record Purchase Bill
          </Button>

          <Button onClick={handleOpenAdd} className="bg-indigo-600 hover:bg-indigo-700 shadow-xs">
            <Plus className="w-4 h-4 mr-1.5" />
            Add Supplier Shop
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Total Outstanding Due to Shops
            </p>
            <div className="p-2 bg-orange-50 text-orange-600 rounded-lg">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold mt-2 text-orange-600 font-mono">
            {formatCurrency(totalOutstandingAll)}
          </p>
          <p className="text-xs text-gray-400 mt-1">Pending payments to raw material vendors</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Total Purchases Billed
            </p>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold mt-2 text-indigo-700 font-mono">
            {formatCurrency(totalBilledAll)}
          </p>
          <p className="text-xs text-gray-400 mt-1">Threads, zari, canvas & machine parts</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Total Payments Made
            </p>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold mt-2 text-emerald-600 font-mono">
            {formatCurrency(totalPaidAll)}
          </p>
          <p className="text-xs text-gray-400 mt-1">Cleared supplier dues</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-4 bg-gray-100 p-1 rounded-xl w-fit">
        <button
          type="button"
          onClick={() => setActiveTab('shops')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            activeTab === 'shops'
              ? 'bg-white text-indigo-700 shadow-xs'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Building2 className="w-4 h-4" />
          Supplier Shops ({shops.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('bills')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            activeTab === 'bills'
              ? 'bg-white text-indigo-700 shadow-xs'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Receipt className="w-4 h-4" />
          Purchase Bills Log ({purchases.length})
        </button>
      </div>

      {activeTab === 'shops' ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
          {/* Search & Filter */}
          <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search shops by name, contact, phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 text-sm"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 font-medium">Category:</span>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="h-9 px-3 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Categories</option>
                <option value="Threads & Zari">Threads & Zari</option>
                <option value="Needles & Machine Spares">Needles & Spares</option>
                <option value="Canvas & Backing">Canvas & Backing</option>
                <option value="Sequins & Beads">Sequins & Beads</option>
                <option value="Oil & Lubricants">Oil & Lubricants</option>
              </select>
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div className="py-16 text-center text-gray-400 text-sm">Loading material shops...</div>
          ) : filteredShops.length === 0 ? (
            <div className="py-16 text-center text-gray-400 text-sm">
              <ShoppingBag className="w-10 h-10 mx-auto text-gray-300 mb-2" />
              No supplier shops found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-600">
                <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-500 border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-3.5">Shop / Vendor</th>
                    <th className="px-6 py-3.5">Category</th>
                    <th className="px-6 py-3.5 text-right">Total Purchases (₹)</th>
                    <th className="px-6 py-3.5 text-right">Total Paid (₹)</th>
                    <th className="px-6 py-3.5 text-right">Balance Due (₹)</th>
                    <th className="px-6 py-3.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredShops.map((s) => (
                    <tr key={s.id} className="hover:bg-gray-50/75 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-bold text-gray-900">{s.name}</p>
                        <p className="text-xs text-gray-500">{s.contact_person}</p>
                        {s.phone && (
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-gray-400 font-mono">{s.phone}</span>
                            <a
                              href={`https://wa.me/91${s.phone.replace(/[^0-9]/g, '').slice(-10)}?text=${encodeURIComponent(
                                `Hello ${s.contact_person}, account check from our embroidery unit. Current balance due: ${formatCurrency(
                                  s.outstanding_balance
                                )}. Thank you!`
                              )}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-2xs text-emerald-600 hover:text-emerald-700 font-medium inline-flex items-center"
                            >
                              <MessageCircle className="w-3 h-3 mr-0.5" /> WhatsApp
                            </a>
                          </div>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          {s.category}
                        </span>
                        {s.address && <p className="text-2xs text-gray-400 mt-1 max-w-xs truncate">{s.address}</p>}
                      </td>

                      <td className="px-6 py-4 text-right font-mono font-medium text-gray-800">
                        {formatCurrency(s.total_billed)}
                      </td>

                      <td className="px-6 py-4 text-right font-mono font-medium text-emerald-600">
                        {formatCurrency(s.total_paid)}
                      </td>

                      <td className="px-6 py-4 text-right font-mono font-bold text-orange-600 text-base">
                        {formatCurrency(s.outstanding_balance)}
                      </td>

                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {s.outstanding_balance > 0 && (
                            <Button
                              size="sm"
                              onClick={() => {
                                setPayingShop(s)
                                setPayAmount(s.outstanding_balance)
                              }}
                              className="h-8 text-xs px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                            >
                              Pay Due
                            </Button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleOpenEdit(s)}
                            className="p-1.5 text-gray-400 hover:text-indigo-600 rounded-md hover:bg-gray-100 transition-colors"
                            title="Edit Shop"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteShop(s)}
                            className="p-1.5 text-gray-400 hover:text-red-600 rounded-md hover:bg-gray-100 transition-colors"
                            title="Remove Shop"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* Purchase Bills Log Tab */
        <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-gray-900 text-sm">Recorded Material Inward Bills</h3>
              <p className="text-xs text-gray-500">Inward invoices for raw materials purchased</p>
            </div>
            <p className="text-xs text-gray-400">{purchases.length} total bills</p>
          </div>

          {purchases.length === 0 ? (
            <div className="py-16 text-center text-gray-400 text-sm">
              <Receipt className="w-10 h-10 mx-auto text-gray-300 mb-2" />
              No purchase bills recorded yet. Click &quot;Record Purchase Bill&quot; above.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-600">
                <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-500 border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-3.5">Bill Date</th>
                    <th className="px-6 py-3.5">Supplier Shop</th>
                    <th className="px-6 py-3.5">Bill / Inv #</th>
                    <th className="px-6 py-3.5">Items Purchased</th>
                    <th className="px-6 py-3.5 text-right">Bill Total (₹)</th>
                    <th className="px-6 py-3.5 text-right">Paid (₹)</th>
                    <th className="px-6 py-3.5 text-right">Balance (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {purchases.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50/75 transition-colors">
                      <td className="px-6 py-4 text-xs font-medium text-gray-700">{formatDate(p.bill_date)}</td>
                      <td className="px-6 py-4 font-bold text-gray-900">{p.shop_name}</td>
                      <td className="px-6 py-4 font-mono text-indigo-600 font-semibold">{p.bill_number}</td>
                      <td className="px-6 py-4 text-xs text-gray-600">{p.items_summary}</td>
                      <td className="px-6 py-4 text-right font-mono font-bold text-gray-900">
                        {formatCurrency(p.amount)}
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-emerald-600">
                        {formatCurrency(p.paid_amount)}
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-bold text-orange-600">
                        {formatCurrency(p.balance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Add / Edit Shop Modal */}
      <Modal
        isOpen={isAddOpen || Boolean(editingShop)}
        onClose={() => {
          setIsAddOpen(false)
          setEditingShop(null)
        }}
        title={editingShop ? 'Edit Material Shop' : 'Add New Material Supplier'}
      >
        <form onSubmit={handleSaveShop} className="space-y-4">
          <div>
            <Label htmlFor="shop-name">Shop / Supplier Name *</Label>
            <Input
              id="shop-name"
              placeholder="e.g. Surat Zari Mart"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="shop-contact">Contact Person</Label>
              <Input
                id="shop-contact"
                placeholder="e.g. Pankaj Bhai"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="shop-phone">Phone / WhatsApp</Label>
              <Input
                id="shop-phone"
                placeholder="e.g. 9825198251"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="shop-cat">Category *</Label>
              <select
                id="shop-cat"
                value={category}
                onChange={(e) => setCategory(e.target.value as MaterialShop['category'])}
                className="w-full h-10 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              >
                <option value="Threads & Zari">Threads & Zari</option>
                <option value="Needles & Machine Spares">Needles & Machine Spares</option>
                <option value="Canvas & Backing">Canvas & Backing Paper</option>
                <option value="Sequins & Beads">Sequins & Beads</option>
                <option value="Oil & Lubricants">Oil & Lubricants</option>
                <option value="General">General Spares</option>
              </select>
            </div>

            {!editingShop && (
              <div>
                <Label htmlFor="shop-opening">Opening Balance Due (₹)</Label>
                <FormattedNumberInput
                  id="shop-opening"
                  prefix="₹"
                  value={openingBalance}
                  onChange={(val) => setOpeningBalance(val || 0)}
                  placeholder="0"
                />
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="shop-addr">Address / GIDC Plot</Label>
            <Input
              id="shop-addr"
              placeholder="e.g. Ring Road Market, Surat"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsAddOpen(false)
                setEditingShop(null)
              }}
            >
              Cancel
            </Button>
            <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700">
              {editingShop ? 'Save Changes' : 'Save Supplier Shop'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Record Purchase Bill Modal */}
      {isPurchaseOpen && (
        <Modal
          isOpen={isPurchaseOpen}
          onClose={() => setIsPurchaseOpen(false)}
          title="Record Raw Material Purchase Bill"
        >
          <form onSubmit={handleSavePurchase} className="space-y-4">
            <div>
              <Label htmlFor="pur-shop">Supplier Shop *</Label>
              <select
                id="pur-shop"
                value={selectedShopId}
                onChange={(e) => setSelectedShopId(e.target.value)}
                className="w-full h-10 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-500"
                required
              >
                {shops.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.category})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="pur-bill-no">Bill / Invoice # *</Label>
                <Input
                  id="pur-bill-no"
                  placeholder="e.g. INV-4921"
                  value={billNumber}
                  onChange={(e) => setBillNumber(e.target.value)}
                  required
                />
              </div>

              <div>
                <Label htmlFor="pur-date">Bill Date *</Label>
                <Input
                  id="pur-date"
                  type="date"
                  value={billDate}
                  onChange={(e) => setBillDate(e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="pur-items">Purchased Items Description</Label>
              <Input
                id="pur-items"
                placeholder="e.g. 50 Cones Poly Thread (Gold & Silver Zari)"
                value={itemsSummary}
                onChange={(e) => setItemsSummary(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="pur-total">Bill Amount (₹) *</Label>
                <FormattedNumberInput
                  id="pur-total"
                  prefix="₹"
                  value={billAmount}
                  onChange={(val) => setBillAmount(val || '')}
                  placeholder="e.g. 12,500"
                  required
                />
              </div>

              <div>
                <Label htmlFor="pur-paid">Paid Amount Now (₹)</Label>
                <FormattedNumberInput
                  id="pur-paid"
                  prefix="₹"
                  value={paidNow}
                  onChange={(val) => setPaidNow(val || 0)}
                  placeholder="0"
                />
              </div>
            </div>

            <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-right">
              <p className="text-2xs text-gray-500">Remaining Balance Added to Shop Due</p>
              <p className="text-xl font-bold font-mono text-orange-600">
                {formatCurrency(Math.max(0, (Number(billAmount) || 0) - (Number(paidNow) || 0)))}
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
              <Button type="button" variant="outline" onClick={() => setIsPurchaseOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700">
                Save Purchase Bill
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Pay Shop Modal */}
      {payingShop && (
        <Modal
          isOpen={Boolean(payingShop)}
          onClose={() => setPayingShop(null)}
          title={`Pay Supplier — ${payingShop.name}`}
        >
          <form onSubmit={handleSavePayment} className="space-y-4">
            <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <p className="text-xs font-semibold text-orange-950">{payingShop.name}</p>
              <p className="text-xs text-orange-800 mt-0.5">
                Current Outstanding Balance Due: {formatCurrency(payingShop.outstanding_balance)}
              </p>
            </div>

            <div>
              <Label htmlFor="pay-shop-amt">Payment Amount (₹) *</Label>
              <FormattedNumberInput
                id="pay-shop-amt"
                prefix="₹"
                value={payAmount}
                onChange={(val) => setPayAmount(val || '')}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="pay-shop-date">Payment Date *</Label>
                <Input
                  id="pay-shop-date"
                  type="date"
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                  required
                />
              </div>

              <div>
                <Label htmlFor="pay-shop-mode">Payment Mode *</Label>
                <select
                  id="pay-shop-mode"
                  value={payMode}
                  onChange={(e) => setPayMode(e.target.value)}
                  className="w-full h-10 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium"
                >
                  <option value="Cash">Cash</option>
                  <option value="Bank Transfer">Bank Transfer (NEFT/RTGS)</option>
                  <option value="UPI">UPI / GPay / PhonePe</option>
                  <option value="Cheque">Cheque</option>
                </select>
              </div>
            </div>

            <div>
              <Label htmlFor="pay-shop-notes">Notes / Reference</Label>
              <Input
                id="pay-shop-notes"
                placeholder="e.g. Paid for thread invoice"
                value={payNotes}
                onChange={(e) => setPayNotes(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
              <Button type="button" variant="outline" onClick={() => setPayingShop(null)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white">
                Record Payment
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
