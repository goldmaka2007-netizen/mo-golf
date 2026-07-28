import React from 'react';
import { DashboardView } from './DashboardView';

export const MainDashboard = React.memo(({ refreshData }: { refreshData: () => void }) => {
  return <DashboardView refreshData={refreshData} />;
});
