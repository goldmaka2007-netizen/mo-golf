import React from 'react';
import { HomeView } from './HomeView';

export const MainDashboard = React.memo(({ refreshData }: { refreshData: () => void }) => {
  return <HomeView refreshData={refreshData} />;
});
