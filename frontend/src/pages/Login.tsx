import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { authAPI } from '@/lib/api'
import { Mail, Lock, Eye, EyeOff, Building2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})
type LoginForm = z.infer<typeof loginSchema>

declare global {
  interface Window { google: any }
}

function Login() {
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const { login, setUserFromResponse } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()
  const googleBtnRef = useRef<HTMLDivElement>(null)

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  // Handle Google credential response
  const handleGoogleCredential = async (response: any) => {
    try {
      const res = await authAPI.googleLogin({ credential: response.credential })
      const { user, token } = res.data
      setUserFromResponse(user, token)
      toast({ title: `Welcome back, ${user.firstName}!` })
      navigate(user.role === 'manager' || user.role === 'admin' ? '/' : '/')
    } catch (err: any) {
      toast({ title: err.response?.data?.message || 'Google sign-in failed', variant: 'destructive' })
    }
  }

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
    if (!clientId || clientId === 'your_google_client_id_here') return

    const init = () => {
      if (!window.google || !googleBtnRef.current) return
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: handleGoogleCredential,
      })
      window.google.accounts.id.renderButton(googleBtnRef.current, {
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        width: googleBtnRef.current.offsetWidth || 400,
        shape: 'rectangular',
      })
    }

    if (window.google) {
      init()
    } else {
      const script = document.createElement('script')
      script.src = 'https://accounts.google.com/gsi/client'
      script.onload = init
      script.async = true
      document.head.appendChild(script)
    }
  }, [])

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true)
    try {
      await login(data.email, data.password)
      toast({ title: 'Welcome back!' })
      navigate('/')
    } catch (err: any) {
      toast({
        title: 'Login failed',
        description: err.response?.data?.message || 'Please check your credentials.',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const googleConfigured = import.meta.env.VITE_GOOGLE_CLIENT_ID &&
    import.meta.env.VITE_GOOGLE_CLIENT_ID !== 'your_google_client_id_here'

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-primary to-primary/80 rounded-2xl shadow-lg mb-4">
            <Building2 className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-1">Socio</h1>
          <p className="text-gray-500 text-sm">Staff scheduling, simplified</p>
        </div>

        <Card className="shadow-xl border-0 bg-white/90 backdrop-blur-sm">
          <CardHeader className="pb-4 text-center">
            <CardTitle className="text-xl">Sign in</CardTitle>
            <CardDescription>Choose how you'd like to sign in</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Google button */}
            {googleConfigured ? (
              <div ref={googleBtnRef} className="w-full" />
            ) : (
              <div className="w-full h-11 flex items-center justify-center rounded-md border border-gray-300 text-sm text-gray-400 bg-gray-50">
                Google sign-in (configure VITE_GOOGLE_CLIENT_ID)
              </div>
            )}

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-2 bg-white text-gray-400">or sign in with email</span>
              </div>
            </div>

            {/* Email form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    {...register('email')}
                    type="email"
                    id="email"
                    placeholder="you@company.com"
                    className={cn('pl-9', errors.email && 'border-red-300')}
                  />
                </div>
                {errors.email && <p className="text-xs text-red-600">{errors.email.message}</p>}
              </div>

              <div className="space-y-1">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    {...register('password')}
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    placeholder="••••••••"
                    className={cn('pl-9 pr-9', errors.password && 'border-red-300')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-xs text-red-600">{errors.password.message}</p>}
              </div>

              <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>

            <p className="text-center text-sm text-gray-500">
              No account?{' '}
              <Link to="/register" className="font-medium text-primary hover:underline">
                Get started
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default Login
