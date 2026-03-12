import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { authAPI } from '@/lib/api'

interface User {
  id: string
  email: string
  username: string
  firstName?: string
  lastName?: string
  role?: 'admin' | 'manager' | 'staff'
  bio?: string
  avatar?: string
  createdAt: string
  updatedAt: string
  staffId?: string
  staff?: {
    id: string
    name: string
    staffType: string
    gender: string
  }
  _count?: {
    shifts: number
    absences: number
  }
  onboardingState?: {
    hasStaff: boolean
    hasRules: boolean
    isComplete: boolean
  }
}

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (data: {
    email: string
    username: string
    password: string
    firstName?: string
    lastName?: string
    role?: 'staff' | 'manager'
  }) => Promise<void>
  logout: () => void
  updateProfile: (data: {
    firstName?: string
    lastName?: string
    bio?: string
    avatar?: string
  }) => Promise<void>
  setUserFromResponse: (user: User, token: string) => void
  isAdmin: () => boolean
  isManager: () => boolean
  isStaff: () => boolean
  hasRole: (role: 'admin' | 'manager' | 'staff') => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      authAPI.getProfile()
        .then(response => {
          setUser(response.data.user)
        })
        .catch(() => {
          localStorage.removeItem('token')
          localStorage.removeItem('user')
        })
        .finally(() => {
          setLoading(false)
        })
    } else {
      setLoading(false)
    }
  }, [])

  const login = async (email: string, password: string) => {
    const response = await authAPI.login({ email, password })
    const { user, token } = response.data
    
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(user))
    setUser(user)
  }

  const register = async (data: {
    email: string
    username: string
    password: string
    firstName?: string
    lastName?: string
    role?: 'staff' | 'manager'
  }) => {
    const response = await authAPI.register(data)
    const { user, token } = response.data
    
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(user))
    setUser(user)
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
  }

  const updateProfile = async (data: {
    firstName?: string
    lastName?: string
    bio?: string
    avatar?: string
  }) => {
    const response = await authAPI.updateProfile(data)
    const updatedUser = response.data.user
    
    localStorage.setItem('user', JSON.stringify(updatedUser))
    setUser(updatedUser)
  }

  const setUserFromResponse = (u: User, token: string) => {
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(u))
    setUser(u)
  }

  const isAdmin = () => user?.role === 'admin'
  const isManager = () => user?.role === 'manager' || user?.role === 'admin'
  const isStaff = () => user?.role === 'staff' || user?.role === 'manager' || user?.role === 'admin'
  const hasRole = (role: 'admin' | 'manager' | 'staff') => {
    if (role === 'admin') return isAdmin()
    if (role === 'manager') return isManager()
    if (role === 'staff') return isStaff()
    return false
  }

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    updateProfile,
    setUserFromResponse,
    isAdmin,
    isManager,
    isStaff,
    hasRole
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
