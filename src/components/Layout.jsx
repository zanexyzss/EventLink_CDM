import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import Toast from './ui/Toast';
import {
  LayoutDashboard, CalendarDays, CheckSquare, Award, BarChart3,
  Users, Settings, LogOut, ChevronLeft, Menu, Key
} from 'lucide-react';
import { useState } from 'react';
import logoImg from '../assets/logo.png';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', roles: ['admin', 'organizer', 'student'] },
  { to: '/events', icon: CalendarDays, label: 'Events', roles: ['admin', 'organizer', 'student'] },
  { to: '/checkin', icon: Key, label: 'Check-in', roles: ['student'] },
  { to: '/my-certificates', icon: Award, label: 'My Certificates', roles: ['student'] },
  { to: '/admin/reports', icon: BarChart3, label: 'Reports', roles: ['admin', 'organizer'] },
  { to: '/admin/users', icon: Users, label: 'Manage Users', roles: ['admin'] },
  { to: '/settings', icon: Settings, label: 'Settings', roles: ['admin'] },
];

export default function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const filteredNav = navItems.filter(item => item.roles.includes(user?.role));

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className={`${collapsed ? 'w-20' : 'w-64'} bg-brand-800 text-white flex flex-col transition-all duration-300 relative`}>
        {/* Logo */}
        <div className="p-5 border-b border-brand-700/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg p-0.5">
              <img src={logoImg} alt="Logo" className="w-full h-full object-contain" />
            </div>
            {!collapsed && (
              <div className="animate-fadeIn">
                <h1 className="font-bold text-base leading-tight">EVENTLINK</h1>
                <p className="text-[10px] text-brand-300 tracking-widest">CDM</p>
              </div>
            )}
          </div>
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-20 w-6 h-6 bg-brand-700 border-2 border-brand-600 rounded-full flex items-center justify-center hover:bg-brand-600 transition-colors z-10"
        >
          {collapsed ? <Menu size={12} /> : <ChevronLeft size={12} />}
        </button>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {filteredNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-white/15 text-white shadow-inner'
                    : 'text-brand-200 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <item.icon size={20} className="flex-shrink-0" />
              {!collapsed && <span className="animate-fadeIn">{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div className="p-4 border-t border-brand-700/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-brand-600 flex items-center justify-center text-sm font-bold flex-shrink-0">
              {user?.full_name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0 animate-fadeIn">
                <p className="text-sm font-medium truncate">{user?.full_name}</p>
                <p className="text-xs text-brand-300 capitalize">{user?.role}</p>
              </div>
            )}
          </div>
          <button
            onClick={handleLogout}
            className={`mt-3 flex items-center gap-2 text-brand-300 hover:text-white text-sm transition-colors w-full ${collapsed ? 'justify-center' : ''}`}
          >
            <LogOut size={16} />
            {!collapsed && <span>Sign out</span>}
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-8">
          <Outlet />
        </div>
      </main>

      <Toast />
    </div>
  );
}
