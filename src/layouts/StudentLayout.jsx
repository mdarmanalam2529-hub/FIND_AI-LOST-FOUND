import React from 'react';
import { Outlet, useSearchParams, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import AppSidebar from '../components/ui/AppSidebar';

export default function StudentLayout() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const activeTab = searchParams.get('tab') || 'my-reports';

  const handleTabChange = (tabKey, subtab) => {
    const params = new URLSearchParams();
    if (tabKey) params.set('tab', tabKey);
    if (subtab) params.set('subtab', subtab);
    navigate(`/dashboard?${params.toString()}`);
  };

  return (
    <div className="app-wrapper in-workspace student-app-wrapper">
      <Navbar />
      <div className="main-content workspace-content-wrap">
        <div className="workspace-shell student-workspace-shell">
          <AppSidebar
            mode="student"
            activeTab={activeTab}
            onTabChange={handleTabChange}
          />
          <main className="workspace-main student-workspace-main">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}

