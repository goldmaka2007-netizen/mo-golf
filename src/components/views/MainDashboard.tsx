import React from 'react';
import { OperationalHomeView } from './OperationalHomeView';

export const MainDashboard = React.memo((_props: { refreshData: () => void }) => {
  return <OperationalHomeView />;
});
