'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff, Sparkles, ArrowRight } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

type LoginForm = z.infer<typeof loginSchema>

export default function LoginPage() {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [isDemoLoading, setIsDemoLoading] = useState(false)
  const supabase = createClient()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginForm) => {
    setServerError(null)

    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    })

    if (error) {
      setServerError('Invalid email or password.')
      return
    }

    // Clear demo cookie if logging in with real credentials
    document.cookie = 'demo_mode=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;'
    router.push('/dashboard')
    router.refresh()
  }

  const handleExploreDemo = () => {
    setIsDemoLoading(true)
    // Set demo cookie for 7 days
    document.cookie = 'demo_mode=true; path=/; max-age=604800; SameSite=Lax'
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        {/* Logo / Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-slate-900 border border-slate-800 rounded-xl mb-3 shadow-md">
            <svg className="w-6 h-6 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 2L4 7v10l8 5 8-5V7l-8-5z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12M8 9.5l8 5M8 14.5l8-5" />
            </svg>
          </div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight">Khatodara Flow &bull; Textile ERP</h1>
          <p className="text-slate-500 text-xs mt-0.5">Embroidery Manufacturing, Lots & Karigar Ledger</p>
        </div>

        {/* Demo Business Exploration Strip */}
        <div className="mb-4 bg-emerald-950 border border-emerald-800/80 rounded-xl p-4 text-white shadow-md">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-3xs uppercase font-mono tracking-wider font-bold text-emerald-300">
                  Instant Interactive Preview
                </span>
              </div>
              <h3 className="font-bold text-sm text-emerald-100 mt-1">
                Explore Demo Business (રાધે એમ્બ્રોઇડરી)
              </h3>
              <p className="text-2xs text-emerald-200/80 mt-0.5 leading-relaxed">
                Experience full software with 10 lots, 5 Surat veparis, 4 factories & workers hisaab without credentials.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleExploreDemo}
            disabled={isDemoLoading}
            className="w-full mt-3 h-10 px-4 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all"
          >
            <Sparkles className="w-3.5 h-3.5 text-slate-950" />
            <span>{isDemoLoading ? 'Loading Demo Business...' : 'Enter Demo Mode (રાધે એમ્બ્રોઇડરી) →'}</span>
          </button>
        </div>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-bold text-slate-900">Sign in to your account</CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Enter your registered credentials to access your production floor
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="email" className="text-xs font-semibold text-slate-700">Business Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@khatodaraflow.com"
                  autoComplete="email"
                  className="h-9 text-xs"
                  {...register('email')}
                />
                {errors.email && (
                  <p className="text-xs text-rose-600">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-xs font-semibold text-slate-700">Password</Label>
                  <Link href="/auth/forgot-password" className="text-xs text-slate-500 hover:text-slate-900">
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="pr-10 h-9 text-xs"
                    {...register('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs text-rose-600">{errors.password.message}</p>
                )}
              </div>

              {serverError && (
                <div className="rounded-md bg-rose-50 border border-rose-200 p-2.5">
                  <p className="text-xs font-medium text-rose-700">{serverError}</p>
                </div>
              )}

              <Button type="submit" className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs h-9" isLoading={isSubmitting}>
                {isSubmitting ? 'Signing in...' : 'Sign In to Factory'}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="justify-center border-t border-slate-100 pt-3 pb-3">
            <p className="text-xs text-slate-500">
              New business?{' '}
              <Link href="/auth/signup" className="text-slate-900 font-semibold hover:underline">
                Create factory account
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
