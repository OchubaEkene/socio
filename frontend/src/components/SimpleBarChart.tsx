import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';

interface BarChartProps {
  data: Array<{
    label: string;
    value: number;
    color?: string;
  }>;
  title?: string;
  height?: number;
  description?: string;
}

const SimpleBarChart: React.FC<BarChartProps> = ({ data, title, height = 200, description }) => {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <div className="p-2 bg-muted rounded-lg w-fit mx-auto mb-4">
              <BarChart3 className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">No data available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const maxValue = Math.max(...data.map(item => item.value));

  const chartContent = (
    <div className="space-y-3" style={{ height }}>
      {data.map((item, index) => (
        <div key={index} className="flex items-center space-x-3">
          <div className="w-20 text-sm text-muted-foreground truncate">
            {item.label}
          </div>
          <div className="flex-1 bg-muted rounded-full h-4 relative overflow-hidden">
            <div
              className={`h-4 rounded-full transition-all duration-500 ease-out ${
                item.color || 'bg-primary'
              }`}
              style={{
                width: maxValue > 0 ? `${(item.value / maxValue) * 100}%` : '0%'
              }}
            />
          </div>
          <div className="w-12 text-sm font-medium text-foreground text-right">
            {item.value}
          </div>
        </div>
      ))}
    </div>
  );

  if (title) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <BarChart3 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">{title}</CardTitle>
              {description && <CardDescription>{description}</CardDescription>}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {chartContent}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full">
      {chartContent}
    </div>
  );
};

export default SimpleBarChart;
