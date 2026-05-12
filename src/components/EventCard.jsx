import { useNavigate } from 'react-router-dom';
import { Calendar, MapPin, Users, Clock } from 'lucide-react';
import { safeFormat, safeIsPast } from '../lib/dateUtils';
import Badge from './ui/Badge';

const typeGradients = {
  seminar: 'from-blue-500 to-indigo-600',
  workshop: 'from-emerald-500 to-teal-600',
  sports: 'from-orange-500 to-red-500',
  cultural: 'from-purple-500 to-pink-500',
  academic: 'from-cyan-500 to-blue-600',
  other: 'from-gray-500 to-slate-600',
};

export default function EventCard({ event }) {
  const navigate = useNavigate();
  const gradient = typeGradients[event.event_type] || typeGradients.other;
  const slotsText = event.max_slots ? `${event.registration_count || 0}/${event.max_slots}` : 'Unlimited';
  const isDeadlinePast = event.registration_deadline && safeIsPast(event.registration_deadline);

  return (
    <div
      onClick={() => navigate(`/events/${event.id}`)}
      className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer overflow-hidden"
    >
      <div className={`h-32 bg-gradient-to-br ${gradient} p-5 relative overflow-hidden`}>
        <div className="absolute inset-0 bg-black/10 group-hover:bg-black/5 transition-colors" />
        <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-white/10 rounded-full" />
        <div className="absolute -top-4 -left-4 w-16 h-16 bg-white/10 rounded-full" />
        <div className="relative z-10">
          <span className="inline-block px-2.5 py-1 bg-white/20 backdrop-blur-sm rounded-md text-xs text-white font-medium capitalize mb-2">
            {event.event_type || 'Event'}
          </span>
          <h3 className="text-white font-bold text-lg leading-tight line-clamp-2">{event.title}</h3>
        </div>
      </div>

      <div className="p-5 space-y-3">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Calendar size={15} className="text-brand-600" />
          <span>{safeFormat(event.event_date, 'MMM d, yyyy · h:mm a')}</span>
        </div>

        {event.venue && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <MapPin size={15} className="text-brand-600" />
            <span className="truncate">{event.venue}</span>
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-gray-50">
          <div className="flex items-center gap-1.5 text-sm text-gray-500">
            <Users size={15} />
            <span>{slotsText} slots</span>
          </div>
          <Badge variant={event.status}>{event.status}</Badge>
        </div>

        {isDeadlinePast && event.status === 'open' && (
          <div className="flex items-center gap-1.5 text-xs text-red-500 font-medium">
            <Clock size={13} />
            <span>Deadline passed</span>
          </div>
        )}
      </div>
    </div>
  );
}
