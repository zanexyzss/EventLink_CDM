import { useState, useEffect } from 'react';
import { useToastStore } from '../../store/toastStore';
import api from '../../lib/api';
import Button from '../../components/ui/Button';
import Spinner from '../../components/ui/Spinner';
import Skeleton from '../../components/ui/Skeleton';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Download, BarChart3, FileText } from 'lucide-react';

export default function Reports() {
  const toast = useToastStore();
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState('');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reportLoading, setReportLoading] = useState(false);

  useEffect(() => { loadEvents(); }, []);

  const loadEvents = async () => {
    try {
      const { data } = await api.get('/events', { params: { limit: 100 } });
      setEvents(data.data || []);
    } catch (err) {
      console.error('Failed to load events:', err);
    } finally { setLoading(false); }
  };

  const loadReport = async (eventId) => {
    setReportLoading(true);
    try {
      const { data } = await api.get(`/reports/events/${eventId}`);
      setReport(data.data);
    } catch (err) {
      toast.error('Failed to load report');
    } finally { setReportLoading(false); }
  };

  const handleExportCSV = async () => {
    if (!selectedEvent) return;
    try {
      const response = await api.get(`/reports/export/${selectedEvent}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `event_${selectedEvent}_report.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('CSV exported!');
    } catch (err) {
      toast.error('Export failed');
    }
  };

  const handleSelectEvent = (e) => {
    const id = e.target.value;
    setSelectedEvent(id);
    if (id) loadReport(id);
    else setReport(null);
  };

  if (loading) return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-5 w-64" />
      </div>
      <Skeleton className="h-28 w-full rounded-2xl" />
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}
      </div>
      <Skeleton className="h-80 w-full rounded-2xl" />
    </div>
  );

  return (
    <div className="space-y-6 animate-fadeIn">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
        <p className="text-gray-500 mt-1">View event analytics and export data</p>
      </div>

      {/* Event Selector */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
        <label className="block text-sm font-medium text-gray-700 mb-2">Select Event</label>
        <div className="flex gap-3">
          <select value={selectedEvent} onChange={handleSelectEvent}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20">
            <option value="">Choose an event...</option>
            {events.map(e => (
              <option key={e.id} value={e.id}>{e.title}</option>
            ))}
          </select>
          <Button variant="secondary" onClick={handleExportCSV} disabled={!selectedEvent}>
            <Download size={16} /> Export CSV
          </Button>
        </div>
      </div>

      {reportLoading && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}
          </div>
          <Skeleton className="h-80 w-full rounded-2xl" />
        </div>
      )}

      {report && !reportLoading && (
        <>
          {/* Report Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              { label: 'Registrations', value: report.registrations_count, color: 'text-blue-600' },
              { label: 'Attendance', value: report.attendance_count, color: 'text-green-600' },
              { label: 'Attendance Rate', value: `${report.attendance_rate}%`, color: 'text-purple-600' },
              { label: 'Certificates Sent', value: report.certificates_sent, color: 'text-amber-600' },
            ].map((card, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm text-center">
                <p className={`text-3xl font-bold ${card.color}`}>{card.value}</p>
                <p className="text-sm text-gray-500 mt-1">{card.label}</p>
              </div>
            ))}
          </div>

          {/* Chart */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <BarChart3 size={20} className="text-brand-600" /> Event Summary
            </h2>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={[
                { name: 'Registered', value: report.registrations_count },
                { name: 'Attended', value: report.attendance_count },
                { name: 'Certificates', value: report.certificates_total || 0 },
                { name: 'Emailed', value: report.certificates_sent },
              ]}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0' }} />
                <Bar dataKey="value" fill="#1e3a8a" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {!selectedEvent && !reportLoading && (
        <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center">
          <FileText size={56} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-xl font-semibold text-gray-600">Select an event</h3>
          <p className="text-gray-400 mt-2">Choose an event above to view its report and analytics.</p>
        </div>
      )}
    </div>
  );
}
