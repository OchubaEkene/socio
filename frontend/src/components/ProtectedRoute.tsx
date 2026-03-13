import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

interface ProtectedRouteProps {
  children: React.ReactNode
}

// Routes managers can access even before completing onboarding
const ONBOARDING_EXEMPT = ['/onboarding', '/settings', '/admin/users']

function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  // Redirect admins/managers who haven't completed onboarding
  // Use localStorage first; fall back to server-side onboardingState
  const localDone = localStorage.getItem('onboarding_complete') === 'true'
  const serverDone = user.onboardingState?.isComplete ?? true
  const onboardingDone = localDone || serverDone
  const isExempt = ONBOARDING_EXEMPT.some(p => location.pathname.startsWith(p))

  if ((user.role === 'admin' || user.role === 'manager') && !onboardingDone && !isExempt) {
    return <Navigate to="/onboarding" replace />
  }

  return <>{children}</>
}

export default ProtectedRoute
