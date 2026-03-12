import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import {
  LogOut,
  Settings,
  Users,
  LayoutDashboard,
  Crown,
  Shield,
  User as UserIcon,
  CalendarDays,
  Menu,
  X,
  Building2,
  BookOpen,
  ClipboardList,
} from 'lucide-react'
import { Toaster } from '@/components/ui/toaster'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

function Layout() {
  const { user, logout, isAdmin, isManager } = useAuth()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const isManagerOrAdmin = isManager() || isAdmin()

  const NavLinks = () => (
    <>
      {/* Manager / Admin nav */}
      {isManagerOrAdmin ? (
        <>
          <Link
            to="/"
            onClick={() => setSidebarOpen(false)}
            className={cn('nav-item', location.pathname === '/' && 'nav-item-active')}
          >
            <LayoutDashboard className="h-5 w-5" />
            <span>Dashboard</span>
          </Link>

          <Link
            to="/rota"
            onClick={() => setSidebarOpen(false)}
            className={cn('nav-item', location.pathname === '/rota' && 'nav-item-active')}
          >
            <ClipboardList className="h-5 w-5" />
            <span>Manage Rota</span>
          </Link>

          <Link
            to="/staff"
            onClick={() => setSidebarOpen(false)}
            className={cn('nav-item', location.pathname.startsWith('/staff') && 'nav-item-active')}
          >
            <Users className="h-5 w-5" />
            <span>Staff</span>
          </Link>

          <Link
            to="/rules"
            onClick={() => setSidebarOpen(false)}
            className={cn('nav-item', location.pathname === '/rules' && 'nav-item-active')}
          >
            <BookOpen className="h-5 w-5" />
            <span>Shift Rules</span>
          </Link>

          <Link
            to="/settings"
            onClick={() => setSidebarOpen(false)}
            className={cn('nav-item', location.pathname === '/settings' && 'nav-item-active')}
          >
            <Settings className="h-5 w-5" />
            <span>Settings</span>
          </Link>

          <Link
            to="/org"
            onClick={() => setSidebarOpen(false)}
            className={cn('nav-item', location.pathname === '/org' && 'nav-item-active')}
          >
            <Building2 className="h-5 w-5" />
            <span>Organisation</span>
          </Link>
        </>
      ) : (
        /* Staff nav */
        <>
          <Link
            to="/my-schedule"
            onClick={() => setSidebarOpen(false)}
            className={cn('nav-item', location.pathname === '/my-schedule' && 'nav-item-active')}
          >
            <CalendarDays className="h-5 w-5" />
            <span>My Schedule</span>
          </Link>

          <Link
            to="/settings"
            onClick={() => setSidebarOpen(false)}
            className={cn('nav-item', location.pathname === '/settings' && 'nav-item-active')}
          >
            <Settings className="h-5 w-5" />
            <span>Settings</span>
          </Link>
        </>
      )}

      <Button
        variant="ghost"
        onClick={() => { logout(); setSidebarOpen(false) }}
        className="w-full justify-start h-auto p-3"
      >
        <LogOut className="h-5 w-5 mr-3" />
        <span>Logout</span>
      </Button>
    </>
  )

  return (
    <div className="page-container">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="content-container">
          <div className="flex h-11 items-center justify-between">
            <div className="flex items-center space-x-3">
              {/* Mobile hamburger */}
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden h-7 w-7"
                onClick={() => setSidebarOpen(v => !v)}
              >
                {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              </Button>
              <Link to="/" className="flex items-center space-x-2">
                <div className="flex h-6 w-6 items-center justify-center rounded bg-primary">
                  <span className="text-xs font-bold text-primary-foreground">S</span>
                </div>
                <span className="text-base font-bold hidden sm:block">Socio</span>
              </Link>
            </div>

            {/* User Menu */}
            <Link to="/settings" className="flex items-center space-x-2 rounded-md px-2 py-1 hover:bg-muted transition-colors cursor-pointer">
              <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 ring-1 ring-primary/20">
                <span className="text-xs font-semibold text-primary">
                  {user?.firstName?.[0]}{user?.lastName?.[0]}
                </span>
              </div>
              <div className="hidden md:block">
                <div className="flex items-center space-x-1.5">
                  <p className="text-xs font-medium">{user?.firstName} {user?.lastName}</p>
                  {user?.role && (
                    <Badge variant={user.role === 'admin' ? 'default' : user.role === 'manager' ? 'secondary' : 'outline'} className="text-xs px-1.5 py-0">
                      {user.role === 'admin' && <Crown className="h-2.5 w-2.5 mr-1" />}
                      {user.role === 'manager' && <Shield className="h-2.5 w-2.5 mr-1" />}
                      {user.role === 'staff' && <UserIcon className="h-2.5 w-2.5 mr-1" />}
                      {user.role}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground leading-none">@{user?.username}</p>
              </div>
            </Link>
          </div>
        </div>
      </header>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="content-container">
        <div className="flex gap-6">
          {/* Sidebar — hidden on mobile unless open */}
          <aside
            className={cn(
              "w-64 flex-shrink-0",
              "fixed md:static top-11 left-0 h-[calc(100vh-2.75rem)] md:h-auto",
              "z-40 md:z-auto bg-background md:bg-transparent",
              "border-r md:border-r-0 overflow-y-auto md:overflow-visible",
              "transition-transform duration-200",
              sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
            )}
          >
            <nav className="space-y-2 p-4 md:p-0 md:py-6">
              <NavLinks />
            </nav>
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0 py-6">
            <Outlet />
          </main>
        </div>
      </div>
      <Toaster />
    </div>
  )
}

export default Layout
