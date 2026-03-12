import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import ProtectedRoute from '@/components/ProtectedRoute'
import Layout from '@/components/Layout'
import Dashboard from '@/pages/Dashboard'
import Login from '@/pages/Login'
import Register from '@/pages/Register'
import Staff from '@/pages/Staff'
import StaffDetail from '@/pages/StaffDetail'
import StaffAvailability from '@/pages/StaffAvailability'
import Rules from '@/pages/Rules'
import Settings from '@/pages/Settings'
import AdminUsers from '@/pages/AdminUsers'
import MySchedule from '@/pages/MySchedule'
import Onboarding from '@/pages/Onboarding'
import ScheduleView from '@/pages/ScheduleView'
import OrgSettings from '@/pages/OrgSettings'
import Rota from '@/pages/Rota'

function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Protected routes */}
        <Route path="/" element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }>
          <Route index element={<Dashboard />} />
          <Route path="staff" element={<Staff />} />
          <Route path="staff/:id" element={<StaffDetail />} />
          <Route path="staff-availability" element={<StaffAvailability />} />
          <Route path="rules" element={<Rules />} />
          <Route path="settings" element={<Settings />} />
          <Route path="admin/users" element={<AdminUsers />} />
          <Route path="my-schedule" element={<MySchedule />} />
          <Route path="onboarding" element={<Onboarding />} />
          <Route path="schedules/:id" element={<ScheduleView />} />
          <Route path="org" element={<OrgSettings />} />
          <Route path="rota" element={<Rota />} />
        </Route>
      </Routes>
    </AuthProvider>
  )
}

export default App
