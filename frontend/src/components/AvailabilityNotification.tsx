import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bell, Users, Clock, CheckCircle } from 'lucide-react';

interface AvailabilityNotificationProps {
  newSubmissions: number;
  totalStaff: number;
  lastUpdated: string;
}

const AvailabilityNotification: React.FC<AvailabilityNotificationProps> = ({
  newSubmissions,
  totalStaff,
  lastUpdated
}) => {
  if (newSubmissions === 0) {
    return null;
  }

  return (
    <Card className="border-green-200 bg-green-50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Bell className="h-5 w-5 text-green-600" />
            <CardTitle className="text-green-900">New Availability Submissions</CardTitle>
          </div>
          <Badge variant="secondary" className="bg-green-100 text-green-800">
            {newSubmissions} new
          </Badge>
        </div>
        <CardDescription className="text-green-700">
          Staff members have submitted their availability for the upcoming week
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1">
              <Users className="h-4 w-4 text-green-600" />
              <span className="text-green-800">{totalStaff} staff members</span>
            </div>
            <div className="flex items-center space-x-1">
              <Clock className="h-4 w-4 text-green-600" />
              <span className="text-green-800">Last updated: {lastUpdated}</span>
            </div>
          </div>
          <div className="flex items-center space-x-1">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span className="text-green-800">Ready for schedule generation</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AvailabilityNotification;
