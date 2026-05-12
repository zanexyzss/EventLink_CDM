import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useToastStore } from '../../store/toastStore';
import api from '../../lib/api';
import { safeFormat } from '../../lib/dateUtils';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Spinner from '../../components/ui/Spinner';
import { Award, Send, Download, Users, CheckCircle, FileText, Mail, RefreshCw, Loader2, ArrowLeft, Sparkles } from 'lucide-react';

export default function CertificateManager() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToastStore();
  const [event, setEvent] = useState(null);
  const [certificates, setCertificates] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [singleAction, setSingleAction] = useState({});

  useEffect(() => { loadData(); }, [id]);

  const loadData = async () => {
    try {
      const [eventRes, certsRes, attRes] = await Promise.all([
        api.get(`/events/${id}`),
        api.get(`/certificates/${id}`),
        api.get(`/attendance/${id}`),
      ]);
      setEvent(eventRes.data.data);
      setCertificates(certsRes.data.data || []);
      setAttendance(attRes.data.data || []);
    } catch (err) {
      toast.error('Failed to load data');
    } finally { setLoading(false); }
  };

  // ─── Bulk actions ────────────────────────────────
  const handleBulkGenerate = async () => {
    setGenerating(true);
    try {
      const { data } = await api.post(`/certificates/${id}/generate`);
      toast.success(`Generated ${data.data.generated} certificates! 🏆`);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Generation failed');
    } finally { setGenerating(false); }
  };

  const handleBulkSend = async () => {
    setSending(true);
    try {
      const { data } = await api.post(`/certificates/${id}/send`);
      toast.success(`Emailed ${data.data.sent} certificates! 📧`);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send');
    } finally { setSending(false); }
  };

  const handleGenerateAndEmailAll = async () => {
    setGenerating(true);
    setSending(true);
    try {
      toast.info('Starting bulk generation and dispatch...');
      // 1. Generate All
      const genRes = await api.post(`/certificates/${id}/generate`);
      // 2. Send All
      const sendRes = await api.post(`/certificates/${id}/send`);
      toast.success(`Success! Generated ${genRes.data.data.generated} and emailed ${sendRes.data.data.sent} certificates! 🏆📧`);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Bulk action failed');
    } finally {
      setGenerating(false);
      setSending(false);
    }
  };

  // ─── Single actions ──────────────────────────────
  const handleSingleGenerate = async (userId) => {
    setSingleAction(prev => ({ ...prev, [`gen_${userId}`]: true }));
    try {
      const { data } = await api.post(`/certificates/${id}/generate-one`, { user_id: userId });
      toast.success(data.message || 'Certificate generated!');
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Generation failed');
    } finally {
      setSingleAction(prev => ({ ...prev, [`gen_${userId}`]: false }));
    }
  };

  const handleSingleEmail = async (userId) => {
    setSingleAction(prev => ({ ...prev, [`send_${userId}`]: true }));
    try {
      const { data } = await api.post(`/certificates/${id}/send-one`, { user_id: userId });
      toast.success(data.message || 'Email sent!');
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to email');
    } finally {
      setSingleAction(prev => ({ ...prev, [`send_${userId}`]: false }));
    }
  };

  const handleDownload = async (userId) => {
    try {
      const response = await api.get(`/certificates/${id}/download/${userId}`, {
        responseType: 'blob'
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const attendee = attendance.find(att => att.user_id === userId);
      const name = attendee?.full_name?.replace(/\s/g, '_') || 'Certificate';
      a.download = `Certificate_${name}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Certificate downloaded! 📥');
    } catch (err) {
      toast.error('Download failed. Generate the certificate first.');
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;
  if (!event) return <div className="text-center py-20 text-gray-500">Event not found</div>;

  // Build merged attendee list with certificate status
  const certMap = {};
  for (const cert of certificates) {
    certMap[cert.user_id] = cert;
  }

  const attendeeList = attendance.map(att => ({
    ...att,
    certificate: certMap[att.user_id] || null,
    hasCert: !!certMap[att.user_id],
    emailed: certMap[att.user_id]?.sent_via_email ? true : false,
  }));

  const totalAttendees = attendeeList.length;
  const totalGenerated = attendeeList.filter(a => a.hasCert).length;
  const totalEmailed = attendeeList.filter(a => a.emailed).length;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Back */}
      <button onClick={() => navigate(`/events/${id}`)} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-brand-600 transition-colors">
        <ArrowLeft size={16} /> Back to Event
      </button>

      {/* Header */}
      <div className="bg-gradient-to-r from-purple-900 via-violet-800 to-indigo-900 rounded-2xl p-8 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(168,85,247,0.15),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(99,102,241,0.15),transparent_60%)]" />
        <div className="relative z-10">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Award size={20} className="text-yellow-400" />
                <span className="text-xs font-semibold tracking-wider uppercase text-purple-300">Certificate Manager</span>
              </div>
              <h1 className="text-3xl font-bold mb-1">{event.title}</h1>
              <p className="text-purple-200 text-sm">
                {safeFormat(event.event_date, 'MMMM d, yyyy')} • {event.venue || 'Virtual'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Sparkles size={32} className="text-yellow-400 opacity-60" />
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-500 font-medium">Total Attendees</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{totalAttendees}</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
              <Users size={20} className="text-white" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-500 font-medium">Certificates Generated</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{totalGenerated}<span className="text-lg text-gray-400 font-normal">/{totalAttendees}</span></p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shadow-lg">
              <FileText size={20} className="text-white" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-500 font-medium">Certificates Emailed</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{totalEmailed}<span className="text-lg text-gray-400 font-normal">/{totalGenerated}</span></p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
              <Mail size={20} className="text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Bulk Actions */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Sparkles size={18} className="text-yellow-500" /> Bulk Actions
        </h2>
        <div className="flex flex-wrap gap-3">
          <Button 
            onClick={handleGenerateAndEmailAll} 
            loading={generating && sending} 
            className="!bg-gradient-to-r !from-amber-500 !to-orange-600 hover:!from-amber-600 hover:!to-orange-700 shadow-md"
            disabled={totalAttendees === 0}
          >
            <Sparkles size={18} /> Generate & Email All
          </Button>
          <Button onClick={handleBulkGenerate} loading={generating && !sending} variant="secondary">
            <Award size={18} /> Generate All
          </Button>
          <Button onClick={handleBulkSend} loading={sending && !generating} variant="success" disabled={totalGenerated === 0}>
            <Send size={18} /> Email All
          </Button>
          <Button variant="ghost" onClick={loadData}>
            <RefreshCw size={16} /> Refresh
          </Button>
        </div>
        {totalAttendees === 0 && (
          <div className="mt-4 p-4 bg-amber-50 border border-amber-100 rounded-xl">
            <p className="text-sm text-amber-700">⚠️ No attendees found. Go to <button onClick={() => navigate(`/attendance/${id}`)} className="text-amber-900 underline font-medium">Attendance</button> and mark students as present before generating certificates.</p>
          </div>
        )}
        {totalGenerated > 0 && totalGenerated === totalAttendees && (
          <div className="mt-4 p-4 bg-green-50 border border-green-100 rounded-xl flex items-center gap-2">
            <CheckCircle size={18} className="text-green-600" />
            <p className="text-sm text-green-700">All certificates have been generated! You can now email or download them individually.</p>
          </div>
        )}
      </div>

      {/* Attendees Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Users size={18} className="text-brand-600" /> Attendee Certificates
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3">Student</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3">Student ID</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3">Certificate</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3">Emailed</th>
                <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {attendeeList.length > 0 ? attendeeList.map((att) => (
                <tr key={att.user_id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-500 to-indigo-600 flex items-center justify-center text-white font-semibold text-sm">
                        {att.full_name?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{att.full_name}</p>
                        <p className="text-xs text-gray-400">{att.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{att.student_id || '—'}</td>
                  <td className="px-6 py-4">
                    {att.hasCert ? (
                      <div className="flex items-center gap-1.5">
                        <CheckCircle size={14} className="text-green-500" />
                        <span className="text-xs font-medium text-green-700">Generated</span>
                      </div>
                    ) : (
                      <span className="text-xs font-medium text-gray-400">Not generated</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {att.emailed ? (
                      <Badge variant="confirmed">Sent</Badge>
                    ) : (
                      <Badge variant="draft">Not sent</Badge>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5 justify-end">
                      {/* Generate */}
                      <button
                        onClick={() => handleSingleGenerate(att.user_id)}
                        disabled={singleAction[`gen_${att.user_id}`]}
                        className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all
                          ${att.hasCert
                            ? 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                            : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
                          } disabled:opacity-50`}
                        title={att.hasCert ? 'Regenerate certificate' : 'Generate certificate'}
                      >
                        {singleAction[`gen_${att.user_id}`] ? <Loader2 size={12} className="animate-spin" /> : <Award size={12} />}
                        {att.hasCert ? 'Regen' : 'Generate'}
                      </button>

                      {/* Download */}
                      <button
                        onClick={() => handleDownload(att.user_id)}
                        disabled={!att.hasCert}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Download PDF"
                      >
                        <Download size={12} /> PDF
                      </button>

                      {/* Email */}
                      <button
                        onClick={() => handleSingleEmail(att.user_id)}
                        disabled={!att.hasCert || singleAction[`send_${att.user_id}`]}
                        className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed
                          ${att.emailed
                            ? 'bg-green-50 text-green-700 hover:bg-green-100'
                            : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                          }`}
                        title={att.emailed ? 'Resend email' : 'Email certificate'}
                      >
                        {singleAction[`send_${att.user_id}`] ? <Loader2 size={12} className="animate-spin" /> : <Mail size={12} />}
                        {att.emailed ? 'Resend' : 'Email'}
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center">
                    <Award size={48} className="mx-auto text-gray-300 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-600 mb-1">No attendees yet</h3>
                    <p className="text-gray-400 text-sm mb-4">Mark attendance first, then generate certificates.</p>
                    <Button variant="secondary" size="sm" onClick={() => navigate(`/attendance/${id}`)}>
                      Go to Attendance →
                    </Button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
