import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import api from '../lib/api';
import { CalendarDays, Users, ClipboardList, ArrowRight, TrendingUp } from 'lucide-react';
import EventCard from '../components/EventCard';
import Spinner from '../components/ui/Spinner';
import Button from '../components/ui/Button';
import { safeFormat } from '../lib/dateUtils';

export default function Dashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [myRegistrations, setMyRegistrations] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const [eventsRes, regsRes] = await Promise.all([
        api.get('/events', { params: { limit: 6 } }),
        api.get('/registrations/mine'),
      ]);
      setEvents(eventsRes.data.data || []);
      setMyRegistrations(regsRes.data.data || []);

      if (user?.role === 'admin') {
        const reportRes = await api.get('/reports/overall');
        setStats(reportRes.data.data || {});
      }
    } catch (err) {
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-96">
      <Spinner size="lg" />
    </div>
  );

  const statCards = user?.role === 'admin' ? [
    { label: 'Total Events', value: stats.totalEvents || 0, icon: CalendarDays, color: 'from-blue-500 to-indigo-600' },
    { label: 'Total Students', value: stats.totalStudents || 0, icon: Users, color: 'from-emerald-500 to-teal-600' },
    { label: 'Registrations', value: stats.totalRegistrations || 0, icon: ClipboardList, color: 'from-purple-500 to-pink-600' },
    { label: 'Emails Sent', value: stats.emailsSent || 0, icon: TrendingUp, color: 'from-orange-500 to-red-500' },
  ] : [
    { label: 'My Registrations', value: myRegistrations.length, icon: ClipboardList, color: 'from-blue-500 to-indigo-600' },
    { label: 'Upcoming Events', value: events.filter(e => e.status === 'open').length, icon: CalendarDays, color: 'from-emerald-500 to-teal-600' },
  ];

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome back, <span className="text-brand-600">{user?.full_name?.split(' ')[0]}</span> 👋
        </h1>
        <p className="text-gray-500 mt-1">Here's what's happening in your campus events.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {statCards.map((stat, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-all duration-300">
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

      {/* Events Grid */}
      <div>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold text-gray-900">Upcoming Events</h2>
          <Button variant="ghost" size="sm" onClick={() => navigate('/events')}>
            View all <ArrowRight size={16} />
          </Button>
        </div>
        {events.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {events.slice(0, 6).map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
            <CalendarDays size={48} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-semibold text-gray-600">No events yet</h3>
            <p className="text-gray-400 mt-1">Events will appear here once they're published.</p>
          </div>
        )}
      </div>

      {/* My Registrations */}
      {user?.role === 'student' && myRegistrations.length > 0 && (
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-5">My Recent Registrations</h2>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3">Event</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3">Date</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3">Venue</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {myRegistrations.slice(0, 5).map((reg) => (
                  <tr key={reg.id} className="hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => navigate(`/events/${reg.event_id}`)}>
                    <td className="px-6 py-4 font-medium text-gray-900">{reg.title}</td>
                    <td className="px-6 py-4 text-gray-500 text-sm">{safeFormat(reg.event_date, 'MMM d, yyyy')}</td>
                    <td className="px-6 py-4 text-gray-500 text-sm">{reg.venue || '—'}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${reg.event_status === 'open' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {reg.event_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
