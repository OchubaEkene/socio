import AvailabilityCalendar from '@/components/AvailabilityCalendar'
import StaffAvailabilityOverview from '@/components/StaffAvailabilityOverview'
import { useAuth } from '@/contexts/AuthContext'

function StaffAvailability() {
  const { user, isManager, isAdmin } = useAuth()

  return (
    <div className="space-y-6">
      {/* Show overview for managers/admins, individual view for staff */}
      {(isManager() || isAdmin()) ? (
        <StaffAvailabilityOverview />
      ) : (
        <>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">My Availability</h1>
            <p className="text-gray-600">Submit your weekly availability using the calendar below.</p>
          </div>

          {!user?.staff?.id ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
              <p className="font-medium text-yellow-800">Account not linked to a staff record</p>
              <p className="text-yellow-700 text-sm mt-1">
                Your account is not yet linked to a staff record. Ask your manager to link your account in Staff Management.
              </p>
            </div>
          ) : (
            <>
              <div className="card">
                <div className="card-content">
                  <AvailabilityCalendar
                    staffId={user.staff.id}
                    staffName={user.staff.name || `${user?.firstName} ${user?.lastName}` || 'My Availability'}
                  />
                </div>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <h3 className="font-medium text-blue-900 mb-3">How to submit your availability:</h3>
                <ol className="text-sm text-blue-800 space-y-2">
                  <li>1. Use the weekly calendar to mark your available time slots</li>
                  <li>2. Click on time slots to toggle availability</li>
                  <li>3. Navigate between weeks using the arrow buttons</li>
                  <li>4. Submit your availability when finished</li>
                  <li>5. Your manager will use this information to create the schedule</li>
                </ol>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

export default StaffAvailability
