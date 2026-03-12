import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '@/contexts/AuthContext'
import { authAPI } from '@/lib/api'
import { Building2, Shield, User, ChevronLeft } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'

declare global {
  interface Window { google: any }
}

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  username: z.string().min(3, 'At least 3 characters').max(30),
  password: z.string().min(6, 'At least 6 characters'),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
})
type RegisterForm = z.infer<typeof registerSchema>

function Register() {
  const [step, setStep] = useState<1 | 2>(1)
  const [role, setRole] = useState<'manager' | 'staff'>('staff')
  const [isLoading, setIsLoading] = useState(false)
  const { register: registerUser, setUserFromResponse } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()
  const googleBtnRef = useRef<HTMLDivElement>(null)

  const { register, handleSubmit, formState: { errors } } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  })

  const googleConfigured = import.meta.env.VITE_GOOGLE_CLIENT_ID &&
    import.meta.env.VITE_GOOGLE_CLIENT_ID !== 'your_google_client_id_here'

  // Handle Google credential — always called after role is chosen (step 2)
  const handleGoogleCredential = async (response: any) => {
    try {
      const res = await authAPI.googleLogin({ credential: response.credential, role })
      const { user, token } = res.data
      setUserFromResponse(user, token)
      toast({ title: `Welcome, ${user.firstName}!` })
      navigate(user.role === 'manager' ? '/onboarding' : '/')
    } catch (err: any) {
      toast({ title: err.response?.data?.message || 'Google sign-in failed', variant: 'destructive' })
    }
  }

  // Re-render Google button whenever step changes to 2
  useEffect(() => {
    if (step !== 2 || !googleConfigured) return

    const init = () => {
      if (!window.google || !googleBtnRef.current) return
      window.google.accounts.id.initialize({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
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
  }, [step])

  const onSubmit = async (data: RegisterForm) => {
    setIsLoading(true)
    try {
      await registerUser({ ...data, role })
      toast({ title: 'Account created!' })
      navigate(role === 'manager' ? '/onboarding' : '/')
    } catch (err: any) {
      toast({ title: err.response?.data?.message || 'Registration failed', variant: 'destructive' })
    } finally {
      setIsLoading(false)
    }
  }

  // ── Step 1: Role selection ─────────────────────────────────────────────────
  if (step === 1) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex flex-col items-center justify-center py-12 px-4">
        <div className="flex items-center gap-2 mb-10">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <Building2 className="h-6 w-6 text-white" />
          </div>
          <span className="text-2xl font-bold text-gray-900">Socio</span>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 mb-2 text-center">How will you use Socio?</h1>
        <p className="text-gray-500 mb-10 text-center">Choose your role to get started</p>

        <div className="flex flex-col sm:flex-row gap-5 w-full max-w-xl">
          <Card
            className="flex-1 cursor-pointer border-2 border-transparent hover:border-blue-500 transition-all shadow-md hover:shadow-lg"
            onClick={() => { setRole('manager'); setStep(2) }}
          >
            <CardContent className="flex flex-col items-center text-center py-10 px-6">
              <div className="bg-blue-100 rounded-full p-4 mb-4">
                <Shield className="h-9 w-9 text-blue-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-1">I'm a Manager</h2>
              <p className="text-gray-500 text-sm">Set up your team and generate rotas</p>
            </CardContent>
          </Card>

          <Card
            className="flex-1 cursor-pointer border-2 border-transparent hover:border-indigo-500 transition-all shadow-md hover:shadow-lg"
            onClick={() => { setRole('staff'); setStep(2) }}
          >
            <CardContent className="flex flex-col items-center text-center py-10 px-6">
              <div className="bg-indigo-100 rounded-full p-4 mb-4">
                <User className="h-9 w-9 text-indigo-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-1">I'm a Staff Member</h2>
              <p className="text-gray-500 text-sm">View your schedule and manage availability</p>
            </CardContent>
          </Card>
        </div>

        <p className="mt-8 text-sm text-gray-500">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-primary hover:underline">Sign in</Link>
        </p>
      </div>
    )
  }

  // ── Step 2: Sign-up options ────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex flex-col items-center justify-center py-12 px-4">
      <div className="flex items-center gap-2 mb-8">
        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
          <Building2 className="h-6 w-6 text-white" />
        </div>
        <span className="text-2xl font-bold text-gray-900">Socio</span>
      </div>

      <Card className="w-full max-w-md shadow-lg border-0 bg-white/90">
        <CardContent className="py-8 px-8 space-y-5">
          <button
            type="button"
            onClick={() => setStep(1)}
            className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-700"
          >
            <ChevronLeft className="h-4 w-4" /> Back
          </button>

          <div>
            <h2 className="text-2xl font-bold text-gray-900">Create your account</h2>
            <p className="text-sm text-gray-400 mt-0.5">
              Signing up as a <span className="font-medium capitalize text-gray-600">{role}</span>
            </p>
          </div>

          {/* Google sign-up button */}
          {googleConfigured ? (
            <div ref={googleBtnRef} className="w-full" />
          ) : (
            <div className="w-full h-11 flex items-center justify-center rounded-md border border-gray-200 text-sm text-gray-400 bg-gray-50">
              Google sign-in (configure VITE_GOOGLE_CLIENT_ID)
            </div>
          )}

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-2 bg-white text-gray-400">or sign up with email</span>
            </div>
          </div>

          {/* Email form */}
          <form className="space-y-3" onSubmit={handleSubmit(onSubmit)}>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>First name</Label>
                <Input {...register('firstName')} className="mt-1" placeholder="Jane" />
              </div>
              <div>
                <Label>Last name</Label>
                <Input {...register('lastName')} className="mt-1" placeholder="Smith" />
              </div>
            </div>
            <div>
              <Label>Email</Label>
              <Input {...register('email')} type="email" className="mt-1" placeholder="jane@company.com" />
              {errors.email && <p className="text-xs text-red-600 mt-0.5">{errors.email.message}</p>}
            </div>
            <div>
              <Label>Username</Label>
              <Input {...register('username')} className="mt-1" placeholder="janesmith" />
              {errors.username && <p className="text-xs text-red-600 mt-0.5">{errors.username.message}</p>}
            </div>
            <div>
              <Label>Password</Label>
              <Input {...register('password')} type="password" className="mt-1" placeholder="••••••••" />
              {errors.password && <p className="text-xs text-red-600 mt-0.5">{errors.password.message}</p>}
            </div>
            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? 'Creating account…' : 'Create account'}
            </Button>
          </form>

          <p className="text-center text-sm text-gray-500">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-primary hover:underline">Sign in</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

export default Register
