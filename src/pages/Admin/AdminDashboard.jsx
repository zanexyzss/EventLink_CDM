import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import Spinner from '../../components/ui/Spinner';
import Skeleton from '../../components/ui/Skeleton';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { CalendarDays, Users, ClipboardList, Mail, TrendingUp, ArrowRight } from 'lucide-react';
import { safeFormat } from '../../lib/dateUtils';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadStats(); }, []);

  const loadStats = async () => {
    try {
      const { data } = await api.get('/reports/overall');
      setStats(data.data || {});
    } catch (err) {
      console.error('Failed to load stats:', err);
    } finally { setLoading(false); }
  };

  if (loading) return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-5 w-64" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}
      </div>
      <Skeleton className="h-80 w-full rounded-2xl" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 rounded-2xl" />)}
      </div>
    </div>
  );

  const statCards = [
    { label: 'Total Events', value: stats.totalEvents || 0, icon: CalendarDays, color: 'from-blue-500 to-indigo-600' },
    { label: 'Total Users', value: stats.totalUsers || 0, icon: Users, color: 'from-emerald-500 to-teal-600' },
    { label: 'Registrations', value: stats.totalRegistrations || 0, icon: ClipboardList, color: 'from-purple-500 to-pink-600' },
    { label: 'Emails Sent', value: stats.emailsSent || 0, icon: Mail, color: 'from-orange-500 to-red-500' },
  ];

  const chartData = (stats.topEvents || []).map(e => ({
    name: e.title?.length > 20 ? e.title.substring(0, 20) + '...' : e.title,
    registrations: e.registration_count
  }));

  return (
    <div className="space-y-8 animate-fadeIn">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-500 mt-1">System overview and analytics</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {statCards.map((stat, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-500 font-medium">{stat.label}</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{stat.value}</p>
              </div>
              <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center shadow-lg`}>
                <stat.icon size={20} className="text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp size={20} className="text-brand-600" /> Top Events by Registrations
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0' }} />
              <Bar dataKey="registrations" fill="#1e3a8a" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button onClick={() => navigate('/admin/users')} className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-all text-left group">
          <Users size={24} className="text-brand-600 mb-3" />
          <h3 className="font-semibold text-gray-900 group-hover:text-brand-600 transition-colors">Manage Users</h3>
          <p className="text-sm text-gray-500 mt-1">View and manage user accounts</p>
        </button>
        <button onClick={() => navigate('/admin/reports')} className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-all text-left group">
          <TrendingUp size={24} className="text-brand-600 mb-3" />
          <h3 className="font-semibold text-gray-900 group-hover:text-brand-600 transition-colors">Reports</h3>
          <p className="text-sm text-gray-500 mt-1">View event reports and analytics</p>
        </button>
        <button onClick={() => navigate('/settings')} className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-all text-left group">
          <Mail size={24} className="text-brand-600 mb-3" />
          <h3 className="font-semibold text-gray-900 group-hover:text-brand-600 transition-colors">Settings</h3>
          <p className="text-sm text-gray-500 mt-1">Configure email and system settings</p>
        </button>
      </div>

      {/* Recent Events */}
      {stats.recentEvents?.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-lg font-bold text-gray-900">Recent Events</h2>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left text-xs font-semibold text-gray-500 uppercase px-6 py-3">Event</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase px-6 py-3">Date</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase px-6 py-3">Registrations</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase px-6 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {stats.recentEvents.slice(0, 5).map((e) => (
                <tr key={e.id} className="hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => navigate(`/events/${e.id}`)}>
                  <td className="px-6 py-4 font-medium text-gray-900">{e.title}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{safeFormat(e.event_date, 'MMM d, yyyy')}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{e.registration_count}</td>
                  <td className="px-6 py-4"><Badge variant={e.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
