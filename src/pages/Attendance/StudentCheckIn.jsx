import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useToastStore } from '../../store/toastStore';
import api from '../../lib/api';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Spinner from '../../components/ui/Spinner';
import Skeleton from '../../components/ui/Skeleton';
import { Key, CheckCircle, CalendarDays, MapPin, Clock } from 'lucide-react';
import { safeFormat } from '../../lib/dateUtils';

export default function StudentCheckIn() {
  const { user } = useAuthStore();
  const toast = useToastStore();
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [pin, setPin] = useState(['', '', '', '', '', '']);
  const [submitting, setSubmitting] = useState(false);
  const [checkedIn, setCheckedIn] = useState({});
  const [searchParams] = useSearchParams();
  const urlPin = searchParams.get('pin');

  useEffect(() => { loadRegistrations(); }, []);

  // Pre-fill PIN if provided via QR code URL
  useEffect(() => {
    if (urlPin && urlPin.length === 6 && /^\d{6}$/.test(urlPin)) {
      setPin(urlPin.split(''));
    }
  }, [urlPin]);

  const loadRegistrations = async () => {
    try {
      const { data } = await api.get('/registrations/mine');
      const regs = data.data || [];
      setRegistrations(regs);

      // Check attendance status for each registration
      const statuses = {};
      for (const reg of regs) {
        try {
          const res = await api.get(`/pin/${reg.event_id}/status`);
          if (res.data.data?.checked_in) {
            statuses[reg.event_id] = res.data.data;
          }
        } catch {}
      }
      setCheckedIn(statuses);
    } catch (err) {
      toast.error('Failed to load events');
    } finally { setLoading(false); }
  };

  const handlePinChange = (index, value) => {
    if (value.length > 1) return;
    if (value && !/^\d$/.test(value)) return;

    const newPin = [...pin];
    newPin[index] = value;
    setPin(newPin);

    // Auto-focus next input
    if (value && index < 5) {
      const next = document.getElementById(`pin-${index + 1}`);
      if (next) next.focus();
    }
  };

  const handlePinKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      const prev = document.getElementById(`pin-${index - 1}`);
      if (prev) prev.focus();
    }
  };

  const handlePinPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setPin(pasted.split(''));
      const last = document.getElementById('pin-5');
      if (last) last.focus();
    }
  };

  const handleSubmit = async () => {
    const pinCode = pin.join('');
    if (pinCode.length !== 6) {
      toast.error('Please enter the full 6-digit PIN');
      return;
    }
    if (!selectedEvent) {
      toast.error('Please select an event first');
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await api.post(`/pin/${selectedEvent.event_id}/checkin`, { pin: pinCode });
      toast.success(data.message || 'Check-in successful! ✅');
      setCheckedIn(prev => ({ ...prev, [selectedEvent.event_id]: { checked_in: true, method: 'pin' } }));
      setPin(['', '', '', '', '', '']);
      setSelectedEvent(null);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Check-in failed');
    } finally { setSubmitting(false); }
  };

  if (loading) return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-5 w-full" />
      </div>
      <Skeleton className="h-64 w-full rounded-2xl" />
      <Skeleton className="h-80 w-full rounded-2xl" />
    </div>
  );

  // Filter to active/recent events only
  const activeEvents = registrations.filter(r => r.event_status === 'open' || r.event_status === 'closed');

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fadeIn">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Event Check-in</h1>
        <p className="text-gray-500 mt-1">Enter the PIN shown on the event screen to confirm your attendance.</p>
      </div>

      {/* Event Selection */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Select Event</h3>
        </div>
        <div className="divide-y divide-gray-50">
          {activeEvents.length > 0 ? activeEvents.map((reg) => {
            const isChecked = !!checkedIn[reg.event_id];
            const isSelected = selectedEvent?.event_id === reg.event_id;
            return (
              <button
                key={reg.event_id}
                onClick={() => !isChecked && setSelectedEvent(reg)}
                disabled={isChecked}
                className={`w-full px-6 py-4 text-left transition-all ${
                  isChecked ? 'bg-green-50 cursor-default' :
                  isSelected ? 'bg-brand-50 ring-2 ring-brand-500 ring-inset' :
                  'hover:bg-gray-50 cursor-pointer'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">{reg.title}</p>
                    <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                      <span className="flex items-center gap-1"><CalendarDays size={12} />{safeFormat(reg.event_date, 'MMM d, yyyy')}</span>
                      {reg.venue && <span className="flex items-center gap-1"><MapPin size={12} />{reg.venue}</span>}
                    </div>
                  </div>
                  {isChecked ? (
                    <Badge variant="confirmed"><CheckCircle size={12} className="mr-1" />Checked In</Badge>
                  ) : isSelected ? (
                    <Badge variant="open">Selected</Badge>
                  ) : (
                    <Badge variant="draft">Tap to select</Badge>
                  )}
                </div>
              </button>
            );
          }) : (
            <div className="px-6 py-12 text-center text-gray-400">
              <CalendarDays size={40} className="mx-auto mb-3 text-gray-300" />
              <p>No active event registrations found.</p>
              <p className="text-xs mt-1">Register for an event first, then come back here to check in.</p>
            </div>
          )}
        </div>
      </div>

      {/* PIN Input */}
      {selectedEvent && !checkedIn[selectedEvent.event_id] && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
          <div className="w-16 h-16 bg-brand-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Key size={28} className="text-brand-600" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">Enter Event PIN</h3>
          <p className="text-sm text-gray-500 mb-6">Look at the projector screen for the 6-digit PIN</p>

          <div className="flex items-center justify-center gap-2 mb-6" onPaste={handlePinPaste}>
            {pin.map((digit, i) => (
              <input
                key={i}
                id={`pin-${i}`}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handlePinChange(i, e.target.value)}
                onKeyDown={(e) => handlePinKeyDown(i, e)}
                className="w-12 h-14 text-center text-2xl font-bold font-mono rounded-xl border-2 border-gray-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all"
                autoFocus={i === 0}
              />
            ))}
          </div>

          <Button onClick={handleSubmit} loading={submitting} size="lg" disabled={pin.join('').length !== 6}>
            <CheckCircle size={18} /> Confirm Check-in
          </Button>

          <p className="text-xs text-gray-400 mt-4">
            Checking in for: <strong>{selectedEvent.title}</strong>
          </p>
        </div>
      )}

      {/* All checked in */}
      {activeEvents.length > 0 && activeEvents.every(r => checkedIn[r.event_id]) && (
        <div className="bg-green-50 rounded-2xl border border-green-200 p-8 text-center">
          <CheckCircle size={48} className="mx-auto text-green-500 mb-3" />
          <h3 className="text-lg font-bold text-green-800">All checked in!</h3>
          <p className="text-sm text-green-600 mt-1">You have confirmed attendance for all your registered events.</p>
        </div>
      )}
    </div>
  );
}
