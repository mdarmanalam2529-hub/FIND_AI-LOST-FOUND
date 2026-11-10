import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from '../components/Navbar';
import AppSidebar from '../components/ui/AppSidebar';

export default function AdminLayout() {
  return (
    <div className="app-wrapper in-workspace admin-app-wrapper">
      <Navbar />
      <div className="main-content workspace-content-wrap">
        <div className="workspace-shell admin-workspace-shell">
          <AppSidebar mode="admin" />
          <main className="workspace-main admin-workspace-main">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}

