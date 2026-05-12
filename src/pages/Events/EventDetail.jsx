import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useToastStore } from '../../store/toastStore';
import api from '../../lib/api';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import Spinner from '../../components/ui/Spinner';
import { Calendar, MapPin, Users, Clock, User, Tag, CheckCircle, XCircle, PlayCircle, StopCircle, Award, ClipboardCheck } from 'lucide-react';
import { safeFormat, safeIsPast } from '../../lib/dateUtils';

export default function EventDetail() {
  const { id } = useParams();
  const { user } = useAuthStore();
  const toast = useToastStore();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [actionLoading, setActionLoading] = useState('');

  useEffect(() => { loadEvent(); }, [id]);

  const loadEvent = async () => {
    try {
      const { data } = await api.get(`/events/${id}`);
      setEvent(data.data);

      // Check if current user is registered
      const regsRes = await api.get('/registrations/mine');
      const myRegs = regsRes.data.data || [];
      setIsRegistered(myRegs.some(r => r.event_id === parseInt(id)));
    } catch (err) {
      toast.error('Failed to load event');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    setRegistering(true);
    try {
      await api.post(`/events/${id}/register`);
      toast.success('Successfully registered! 🎉');
      setIsRegistered(true);
      setShowConfirmModal(false);
      loadEvent();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Registration failed');
    } finally {
      setRegistering(false);
    }
  };

  const handleCancelRegistration = async () => {
    try {
      await api.delete(`/events/${id}/register`);
      toast.success('Registration cancelled');
      setIsRegistered(false);
      loadEvent();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to cancel');
    }
  };

  const handleStatusChange = async (action) => {
    setActionLoading(action);
    try {
      await api.post(`/events/${id}/${action}`);
      toast.success(`Event ${action === 'open' ? 'opened' : action === 'close' ? 'closed' : 'completed'}!`);
      loadEvent();
    } catch (err) {
      toast.error(err.response?.data?.error || `Failed to ${action} event`);
    } finally {
      setActionLoading('');
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;
  if (!event) return <div className="text-center py-20 text-gray-500">Event not found</div>;

  const isOrganizer = ['admin', 'organizer'].includes(user?.role);
  const slotsRemaining = event.max_slots ? event.max_slots - (event.registration_count || 0) : null;
  const deadlinePast = event.registration_deadline && safeIsPast(event.registration_deadline);
  const canRegister = event.status === 'open' && !isRegistered && !deadlinePast && (slotsRemaining === null || slotsRemaining > 0);

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fadeIn">
      {/* Back */}
      <button onClick={() => navigate('/events')} className="text-sm text-gray-500 hover:text-brand-600 transition-colors">
        ← Back to Events
      </button>

      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-brand-800 to-indigo-900 p-8 text-white">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Badge variant={event.status}>{event.status}</Badge>
                {event.event_type && (
                  <span className="px-2.5 py-0.5 bg-white/20 rounded-full text-xs font-medium capitalize">{event.event_type}</span>
                )}
              </div>
              <h1 className="text-3xl font-bold mb-2">{event.title}</h1>
              {event.organizer_name && <p className="text-brand-200">Organized by {event.organizer_name}</p>}
            </div>
            {event.event_code && (
              <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3 text-center">
                <p className="text-[10px] text-brand-300 uppercase tracking-wider">Event Code</p>
                <p className="text-lg font-bold font-mono">{event.event_code}</p>
              </div>
            )}
          </div>
        </div>

        <div className="p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="flex items-center gap-3 text-gray-600">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center"><Calendar size={20} className="text-blue-600" /></div>
              <div><p className="text-xs text-gray-400">Date & Time</p><p className="font-medium">{safeFormat(event.event_date, 'MMMM d, yyyy · h:mm a')}</p></div>
            </div>
            <div className="flex items-center gap-3 text-gray-600">
              <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center"><MapPin size={20} className="text-green-600" /></div>
              <div><p className="text-xs text-gray-400">Venue</p><p className="font-medium">{event.venue || 'To be announced'}</p></div>
            </div>
            <div className="flex items-center gap-3 text-gray-600">
              <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center"><Users size={20} className="text-purple-600" /></div>
              <div><p className="text-xs text-gray-400">Slots</p><p className="font-medium">{event.registration_count || 0} / {event.max_slots || '∞'} registered</p></div>
            </div>
            {event.registration_deadline && (
              <div className="flex items-center gap-3 text-gray-600">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${deadlinePast ? 'bg-red-50' : 'bg-amber-50'}`}>
                  <Clock size={20} className={deadlinePast ? 'text-red-600' : 'text-amber-600'} />
                </div>
                <div><p className="text-xs text-gray-400">Registration Deadline</p><p className="font-medium">{safeFormat(event.registration_deadline, 'MMM d, yyyy · h:mm a')}</p></div>
              </div>
            )}
          </div>

          {event.description && (
            <div className="mb-8">
              <h3 className="font-semibold text-gray-900 mb-2">Description</h3>
              <p className="text-gray-600 leading-relaxed whitespace-pre-wrap">{event.description}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3 pt-6 border-t border-gray-100">
            {user?.role === 'student' && (
              <>
                {canRegister && (
                  <Button onClick={() => setShowConfirmModal(true)} size="lg">
                    <CheckCircle size={18} /> Register for this Event
                  </Button>
                )}
                {isRegistered && (
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-xl text-sm font-medium">
                      <CheckCircle size={16} /> You are registered
                    </span>
                    <Button variant="danger" size="sm" onClick={handleCancelRegistration}>
                      Cancel Registration
                    </Button>
                  </div>
                )}
                {!canRegister && !isRegistered && event.status === 'open' && (
                  <span className="text-sm text-red-500">{deadlinePast ? 'Registration deadline passed' : 'No slots available'}</span>
                )}
              </>
            )}

            {isOrganizer && (
              <>
                {event.status === 'draft' && (
                  <Button onClick={() => handleStatusChange('open')} loading={actionLoading === 'open'}>
                    <PlayCircle size={18} /> Open Registration
                  </Button>
                )}
                {event.status === 'open' && (
                  <Button variant="secondary" onClick={() => handleStatusChange('close')} loading={actionLoading === 'close'}>
                    <StopCircle size={18} /> Close Registration
                  </Button>
                )}
                {(event.status === 'open' || event.status === 'closed') && (
                  <Button variant="ghost" onClick={() => handleStatusChange('complete')} loading={actionLoading === 'complete'}>
                    <CheckCircle size={18} /> Mark Complete
                  </Button>
                )}
                <Button variant="secondary" onClick={() => navigate(`/attendance/${id}`)}>
                  <ClipboardCheck size={18} /> Attendance
                </Button>
                <Button variant="secondary" onClick={() => navigate(`/certificates/${id}`)}>
                  <Award size={18} /> Certificates
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Registration Confirm Modal */}
      <Modal isOpen={showConfirmModal} onClose={() => setShowConfirmModal(false)} title="Confirm Registration">
        <div className="space-y-4">
          <p className="text-gray-600">You are about to register for <strong>{event.title}</strong>.</p>
          <p className="text-sm text-gray-500">A confirmation email with your QR code will be sent after registration.</p>
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="ghost" onClick={() => setShowConfirmModal(false)}>Cancel</Button>
            <Button onClick={handleRegister} loading={registering}>Confirm Registration</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
