import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useToastStore } from '../../store/toastStore';
import api from '../../lib/api';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Spinner from '../../components/ui/Spinner';
import { Search, UserCheck, Users, Key, Clock, Award, RefreshCw, StopCircle, PlayCircle, Copy, QrCode } from 'lucide-react';
import { safeFormat } from '../../lib/dateUtils';
import QRCode from 'qrcode';

export default function AttendanceScanner() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToastStore();
  const [event, setEvent] = useState(null);
  const [registrations, setRegistrations] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [marking, setMarking] = useState(null);
  const [awarding, setAwarding] = useState({});
  const [tab, setTab] = useState('pin');

  // PIN state
  const [activePin, setActivePin] = useState(null);
  const [pinExpiry, setPinExpiry] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [pinDuration, setPinDuration] = useState(3);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const timerRef = useRef(null);

  useEffect(() => { loadData(); }, [id]);

  // Generate QR code when activePin changes
  useEffect(() => {
    if (activePin) {
      const url = `${window.location.origin}/checkin?pin=${activePin}`;
      QRCode.toDataURL(url, {
        width: 250,
        margin: 2,
        color: { dark: '#1e3a8a', light: '#ffffff' } // dark blue
      }).then(setQrDataUrl).catch(console.error);
    } else {
      setQrDataUrl('');
    }
  }, [activePin]);

  // Countdown timer for PIN expiry
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!pinExpiry) { setTimeLeft(0); return; }

    const tick = () => {
      const remaining = Math.max(0, Math.floor((new Date(pinExpiry) - new Date()) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0) {
        setActivePin(null);
        setPinExpiry(null);
        clearInterval(timerRef.current);
      }
    };
    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => clearInterval(timerRef.current);
  }, [pinExpiry]);

  // Poll for new check-ins every 5s when PIN is active
  useEffect(() => {
    if (!activePin) return;
    const poll = setInterval(() => { loadData(true); }, 5000);
    return () => clearInterval(poll);
  }, [activePin]);

  const loadData = async (silent = false) => {
    try {
      const [eventRes, regsRes, attRes] = await Promise.all([
        api.get(`/events/${id}`),
        api.get(`/events/${id}/registrations`),
        api.get(`/attendance/${id}`),
      ]);
      setEvent(eventRes.data.data);
      setRegistrations(regsRes.data.data || []);
      setAttendance(attRes.data.data || []);

      // Also check for active PIN
      try {
        const pinRes = await api.get(`/pin/${id}/active`);
        if (pinRes.data.data) {
          setActivePin(pinRes.data.data.pin);
          setPinExpiry(pinRes.data.data.expires_at);
        }
      } catch {}
    } catch (err) {
      if (!silent) toast.error('Failed to load data');
    } finally { if (!silent) setLoading(false); }
  };

  const markPresent = async (userId) => {
    setMarking(userId);
    try {
      await api.post(`/attendance/${id}`, { user_id: userId, method: 'manual' });
      toast.success('Attendance marked! ✅');
      loadData(true);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to mark attendance');
    } finally { setMarking(null); }
  };

  const handleAwardCertificate = async (userId) => {
    setAwarding(prev => ({ ...prev, [userId]: true }));
    try {
      await api.post(`/certificates/${id}/generate-one`, { user_id: userId });
      await api.post(`/certificates/${id}/send-one`, { user_id: userId });
      toast.success('Certificate generated and emailed! 🏆📧');
      loadData(true);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to award certificate');
    } finally {
      setAwarding(prev => ({ ...prev, [userId]: false }));
    }
  };

  // ─── PIN functions ────────────────────────────
  const handleGeneratePin = async () => {
    setGenerating(true);
    try {
      const { data } = await api.post(`/pin/${id}/generate`, { duration: pinDuration });
      setActivePin(data.data.pin);
      setPinExpiry(data.data.expires_at);
      toast.success(`PIN generated! Show this on screen.`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to generate PIN');
    } finally { setGenerating(false); }
  };

  const handleStopPin = async () => {
    try {
      await api.post(`/pin/${id}/stop`);
      setActivePin(null);
      setPinExpiry(null);
      toast.success('Check-in stopped');
    } catch (err) {
      toast.error('Failed to stop');
    }
  };

  const copyPin = () => {
    navigator.clipboard.writeText(activePin);
    toast.success('PIN copied!');
  };

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;
  if (!event) return <div className="text-center py-20 text-gray-500">Event not found</div>;

  const attendedIds = new Set(attendance.map(a => a.user_id));
  const filtered = registrations.filter(r =>
    !search || r.full_name?.toLowerCase().includes(search.toLowerCase()) || r.student_id?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fadeIn">
      <button onClick={() => navigate(`/events/${id}`)} className="text-sm text-gray-500 hover:text-brand-600">← Back to Event</button>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Attendance</h1>
          <p className="text-gray-500 mt-1">{event.title}</p>
        </div>
        <div className="flex gap-4">
          <div className="bg-white rounded-xl border border-gray-100 px-5 py-3 text-center shadow-sm">
            <p className="text-2xl font-bold text-green-600">{attendance.length}</p>
            <p className="text-xs text-gray-400">Present</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 px-5 py-3 text-center shadow-sm">
            <p className="text-2xl font-bold text-gray-900">{registrations.length}</p>
            <p className="text-xs text-gray-400">Registered</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        <button onClick={() => setTab('pin')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'pin' ? 'bg-white shadow text-brand-800' : 'text-gray-500'}`}>
          <Key size={14} className="inline mr-1.5" />Live PIN
        </button>
        <button onClick={() => setTab('manual')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'manual' ? 'bg-white shadow text-brand-800' : 'text-gray-500'}`}>
          <Search size={14} className="inline mr-1.5" />Manual
        </button>
      </div>

      {/* ════════════════════ LIVE PIN TAB ════════════════════ */}
      {tab === 'pin' && (
        <div className="space-y-6">
          {/* PIN Display Card */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {activePin ? (
              /* ── Active PIN ── */
              <div className="text-center py-10 px-8">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-50 text-green-700 rounded-full text-xs font-semibold mb-6">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                  LIVE — Show this on projector
                </div>

                {qrDataUrl && (
                  <div className="flex justify-center mb-6">
                    <div className="p-3 bg-white rounded-3xl shadow-sm border border-gray-100">
                      <img src={qrDataUrl} alt="Check-in QR" className="w-48 h-48 rounded-xl" />
                    </div>
                  </div>
                )}

                <p className="text-sm text-gray-500 mb-3 uppercase tracking-widest font-semibold">Or enter PIN manually</p>
                <div className="flex items-center justify-center gap-3 mb-4">
                  {activePin.split('').map((digit, i) => (
                    <div key={i} className="w-16 h-20 bg-gradient-to-b from-brand-700 to-brand-900 rounded-xl flex items-center justify-center shadow-lg">
                      <span className="text-4xl font-bold text-white font-mono">{digit}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-center gap-2 text-sm mb-6">
                  <Clock size={14} className={timeLeft <= 30 ? 'text-red-500' : 'text-gray-400'} />
                  <span className={`font-mono font-semibold ${timeLeft <= 30 ? 'text-red-500' : 'text-gray-600'}`}>
                    {formatTime(timeLeft)}
                  </span>
                  <span className="text-gray-400">remaining</span>
                </div>
                <div className="flex items-center justify-center gap-3">
                  <Button onClick={handleGeneratePin} loading={generating} variant="secondary" size="sm">
                    <RefreshCw size={14} /> New PIN
                  </Button>
                  <Button onClick={copyPin} variant="ghost" size="sm">
                    <Copy size={14} /> Copy
                  </Button>
                  <Button onClick={handleStopPin} variant="danger" size="sm">
                    <StopCircle size={14} /> Stop
                  </Button>
                </div>
                <p className="text-xs text-gray-400 mt-4">Students enter this PIN on their device to check in. PIN auto-expires.</p>
              </div>
            ) : (
              /* ── No Active PIN ── */
              <div className="text-center py-12 px-8">
                <div className="w-20 h-20 bg-brand-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
                  <Key size={36} className="text-brand-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Live PIN Check-in</h3>
                <p className="text-gray-500 text-sm mb-6 max-w-md mx-auto">
                  Generate a 6-digit PIN and display it on the projector screen. Students enter the PIN on their phone to confirm attendance.
                </p>
                <div className="flex items-center justify-center gap-3 mb-4">
                  <label className="text-sm text-gray-500">PIN Duration:</label>
                  <select
                    value={pinDuration}
                    onChange={(e) => setPinDuration(parseInt(e.target.value))}
                    className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  >
                    <option value={1}>1 minute</option>
                    <option value={2}>2 minutes</option>
                    <option value={3}>3 minutes</option>
                    <option value={5}>5 minutes</option>
                    <option value={10}>10 minutes</option>
                  </select>
                </div>
                <Button onClick={handleGeneratePin} loading={generating} size="lg">
                  <PlayCircle size={18} /> Start Check-in
                </Button>
              </div>
            )}
          </div>

          {/* Live Attendance Feed */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Users size={18} className="text-brand-600" /> Live Check-ins
                {activePin && <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>}
              </h3>
              <span className="text-sm text-gray-400">{attendance.length} / {registrations.length} present</span>
            </div>
            {attendance.length > 0 ? (
              <div className="divide-y divide-gray-50 max-h-[400px] overflow-y-auto">
                {attendance.map((a) => (
                  <div key={a.id} className="px-6 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                        <UserCheck size={14} className="text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{a.full_name}</p>
                        <p className="text-xs text-gray-400">{a.student_id || a.email}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant={a.method === 'pin' ? 'confirmed' : 'draft'}>
                        {a.method === 'pin' ? '🔑 PIN' : a.method === 'manual' ? '✋ Manual' : a.method}
                      </Badge>
                      <p className="text-xs text-gray-400 mt-1">{safeFormat(a.checked_in_at, 'h:mm a')}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-6 py-12 text-center text-gray-400 text-sm">
                No check-ins yet. Generate a PIN to start.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════ MANUAL TAB ════════════════════ */}
      {tab === 'manual' && (
        <>
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Search by name or student ID..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500" />
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase px-6 py-3">Student</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase px-6 py-3">Student ID</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase px-6 py-3">Department</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase px-6 py-3">Status</th>
                  <th className="text-right text-xs font-semibold text-gray-500 uppercase px-6 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((reg) => {
                  const attended = attendedIds.has(reg.user_id);
                  const attRecord = attendance.find(a => a.user_id === reg.user_id);
                  return (
                    <tr key={reg.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-medium text-gray-900">{reg.full_name}</p>
                        <p className="text-xs text-gray-400">{reg.email}</p>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{reg.student_id || '—'}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{reg.department || '—'}</td>
                      <td className="px-6 py-4">
                        {attended ? (
                          <div>
                            <Badge variant="confirmed">Present</Badge>
                            {attRecord && <p className="text-xs text-gray-400 mt-1">{safeFormat(attRecord.checked_in_at, 'h:mm a')}</p>}
                          </div>
                        ) : (
                          <Badge variant="draft">Not checked in</Badge>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {!attended ? (
                          <Button size="sm" onClick={() => markPresent(reg.user_id)} loading={marking === reg.user_id}>
                            <UserCheck size={14} /> Mark Present
                          </Button>
                        ) : (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleAwardCertificate(reg.user_id)}
                            loading={awarding[reg.user_id]}
                          >
                            <Award size={14} /> Award Cert
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-400">No registrants found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
