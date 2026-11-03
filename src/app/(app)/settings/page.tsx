'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import MasterListManager from '@/components/settings/MasterListManager'
import { Building2, Scissors, Wallet, CreditCard } from 'lucide-react'
import { cn } from '@/lib/utils'

const settingsSchema = z.object({
  name: z.string().min(2, 'Business name must be at least 2 characters'),
  owner_name: z.string().min(2, 'Owner name is required'),
  phone: z.string().min(10, 'Enter a valid phone number'),
  address: z.string().optional(),
  email: z.string().email('Enter a valid email'),
})

type SettingsForm = z.infer<typeof settingsSchema>

type TabType = 'profile' | 'work_types' | 'expense_categories' | 'payment_modes'

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('profile')
  const [businessId, setBusinessId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [success, setSuccess] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [logoUploading, setLogoUploading] = useState(false)
  const supabase = createClient()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<SettingsForm>({
    resolver: zodResolver(settingsSchema),
  })

  useEffect(() => {
    const loadBusiness = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: business } = await supabase
        .from('businesses')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (business) {
        setBusinessId(business.id)
        reset({
          name: business.name,
          owner_name: business.owner_name,
          phone: business.phone,
          address: business.address ?? '',
          email: business.email,
        })
        setLogoUrl(business.logo_url)
      }
      setLoading(false)
    }

    loadBusiness()
  }, [reset, supabase])

  const onSubmit = async (data: SettingsForm) => {
    setServerError(null)
    setSuccess(false)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase
      .from('businesses')
      .update({
        name: data.name,
        owner_name: data.owner_name,
        phone: data.phone,
        address: data.address,
        email: data.email,
      })
      .eq('user_id', user.id)

    if (error) {
      setServerError(error.message)
      return
    }

    setSuccess(true)
    setTimeout(() => setSuccess(false), 3000)
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setLogoUploading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const fileExt = file.name.split('.').pop()
    const fileName = `${user.id}/logo.${fileExt}`

    const { error: uploadError } = await supabase.storage
      .from('business-assets')
      .upload(fileName, file, { upsert: true })

    if (uploadError) {
      setServerError('Failed to upload logo: ' + uploadError.message)
      setLogoUploading(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage
      .from('business-assets')
      .getPublicUrl(fileName)

    await supabase
      .from('businesses')
      .update({ logo_url: publicUrl })
      .eq('user_id', user.id)

    setLogoUrl(publicUrl)
    setLogoUploading(false)
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  const tabs = [
    { id: 'profile' as TabType, label: 'Business Profile', icon: Building2 },
    { id: 'work_types' as TabType, label: 'Work Types', icon: Scissors },
    { id: 'expense_categories' as TabType, label: 'Expense Categories', icon: Wallet },
    { id: 'payment_modes' as TabType, label: 'Payment Modes', icon: CreditCard },
  ]

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="pb-6 border-b border-slate-200">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-2xs font-semibold uppercase tracking-wider text-slate-600 bg-slate-100 px-2 py-0.5 rounded">Preferences & Masters</span>
          <span className="text-slate-300">/</span>
          <span className="text-xs text-slate-500 font-medium">Business Configuration</span>
        </div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Settings & Master Data</h1>
        <p className="text-xs text-slate-500 mt-1">
          Configure business metadata, communication defaults, and master dropdown dictionaries.
        </p>
      </div>

      {/* Tabs Bar */}
      <div className="flex border-b border-slate-200 gap-6 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 pb-3 text-xs font-semibold whitespace-nowrap transition-colors border-b-2 -mb-px',
                isActive
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              )}
            >
              <Icon className={cn('w-3.5 h-3.5', isActive ? 'text-slate-900' : 'text-slate-400')} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* TAB 1: Business Profile */}
      {activeTab === 'profile' && (
        <div className="space-y-6 max-w-2xl">
          {/* Logo */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Business Logo</CardTitle>
              <CardDescription>Upload your business logo (PNG, JPG up to 2MB)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden bg-gray-50">
                  {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoUrl} alt="Business logo" className="w-full h-full object-cover" />
                  ) : (
                    <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  )}
                </div>
                <div>
                  <Button
                    variant="outline"
                    size="sm"
                    isLoading={logoUploading}
                    onClick={() => document.getElementById('logo-upload')?.click()}
                    type="button"
                  >
                    {logoUploading ? 'Uploading...' : 'Upload Logo'}
                  </Button>
                  <input
                    id="logo-upload"
                    type="file"
                    accept="image/png,image/jpeg,image/jpg"
                    className="hidden"
                    onChange={handleLogoUpload}
                  />
                  <p className="text-xs text-gray-400 mt-1">PNG or JPG, max 2MB</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Business Info Form */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Business Information</CardTitle>
              <CardDescription>This information appears on slips, WhatsApp messages, and reports</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="name">Business Name *</Label>
                    <Input id="name" {...register('name')} />
                    {errors.name && <p className="text-xs text-red-600">{errors.name.message}</p>}
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="owner_name">Owner Name *</Label>
                    <Input id="owner_name" {...register('owner_name')} />
                    {errors.owner_name && <p className="text-xs text-red-600">{errors.owner_name.message}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="phone">Phone Number *</Label>
                    <Input id="phone" type="tel" {...register('phone')} />
                    {errors.phone && <p className="text-xs text-red-600">{errors.phone.message}</p>}
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="email">Business Email *</Label>
                    <Input id="email" type="email" {...register('email')} />
                    {errors.email && <p className="text-xs text-red-600">{errors.email.message}</p>}
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="address">Address</Label>
                  <Textarea
                    id="address"
                    placeholder="Factory or office address (optional)"
                    rows={3}
                    {...register('address')}
                  />
                </div>

                {serverError && (
                  <div className="rounded-md bg-red-50 border border-red-200 p-3">
                    <p className="text-sm text-red-700">{serverError}</p>
                  </div>
                )}

                {success && (
                  <div className="rounded-md bg-green-50 border border-green-200 p-3">
                    <p className="text-sm text-green-700">✓ Settings saved successfully</p>
                  </div>
                )}

                <div className="flex justify-end">
                  <Button type="submit" isLoading={isSubmitting} disabled={!isDirty}>
                    {isSubmitting ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 2: Work Types */}
      {activeTab === 'work_types' && businessId && (
        <div className="max-w-2xl">
          <MasterListManager
            tableName="work_types"
            title="Work Types"
            description="Garment parts embroidered in your lots (e.g. Top, Sleeve, Plazo). Added names appear in all lot entry dropdowns."
            placeholder="Enter work type (e.g. Dupatta, Kali, Border, કોટી)..."
            businessId={businessId}
            helpText="Supports English, Gujarati (ગુજરાતી), and Hindi (हिंदी) names."
          />
        </div>
      )}

      {/* TAB 3: Expense Categories */}
      {activeTab === 'expense_categories' && businessId && (
        <div className="max-w-2xl">
          <MasterListManager
            tableName="expense_categories"
            title="Expense Categories"
            description="Categories used to track factory operational expenses for profit & loss reports."
            placeholder="Enter category name (e.g. Thread, Chai/Snacks, Needle Maintenance)..."
            businessId={businessId}
            helpText="Common categories: Rent, Electricity, Salary, Transport, Maintenance, Chai/Expense."
          />
        </div>
      )}

      {/* TAB 4: Payment Modes */}
      {activeTab === 'payment_modes' && businessId && (
        <div className="max-w-2xl">
          <MasterListManager
            tableName="payment_modes"
            title="Payment Modes"
            description="Payment methods available when receiving money from Veparis or paying factories/shops."
            placeholder="Enter payment mode (e.g. Cash, GPay, PhonePe, RTGS, Angadia)..."
            businessId={businessId}
            helpText="Standard modes: Cash, Bank Transfer, UPI, Cheque, Angadia."
          />
        </div>
      )}
    </div>
  )
}
