import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToastStore } from '../../store/toastStore';
import api from '../../lib/api';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { CalendarDays, MapPin, FileText, Users, Clock, Zap } from 'lucide-react';

const schema = z.object({
  title: z.string().min(2, 'Title is required'),
  description: z.string().optional(),
  event_type: z.string().optional(),
  venue: z.string().optional(),
  event_date: z.string().min(1, 'Event date is required'),
  registration_deadline: z.string().optional(),
  max_slots: z.string().optional(),
  publish: z.boolean().optional(),
});

export default function CreateEvent() {
  const navigate = useNavigate();
  const toast = useToastStore();
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { event_type: 'seminar', publish: false },
  });

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      const payload = {
        title: data.title, description: data.description || undefined,
        event_type: data.event_type || undefined, venue: data.venue || undefined,
        event_date: data.event_date, registration_deadline: data.registration_deadline || undefined,
        max_slots: data.max_slots ? parseInt(data.max_slots) : undefined,
        status: data.publish ? 'open' : 'draft',
      };
      const { data: res } = await api.post('/events', payload);
      toast.success('Event created! 🎉');
      navigate(`/events/${res.data.id}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create event');
    } finally { setLoading(false); }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fadeIn">
      <div>
        <button onClick={() => navigate('/events')} className="text-sm text-gray-500 hover:text-brand-600 mb-4 block">← Back to Events</button>
        <h1 className="text-3xl font-bold text-gray-900">Create New Event</h1>
        <p className="text-gray-500 mt-1">Fill in details to create a new campus event.</p>
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <Input label="Event Title *" icon={FileText} placeholder="e.g. Web Development Workshop" error={errors.title?.message} {...register('title')} />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
            <textarea {...register('description')} rows={4} placeholder="Describe your event..." className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm placeholder-gray-400 shadow-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Event Type</label>
              <select {...register('event_type')} className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm shadow-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none">
                <option value="seminar">Seminar</option><option value="workshop">Workshop</option>
                <option value="sports">Sports</option><option value="cultural">Cultural</option>
                <option value="academic">Academic</option><option value="other">Other</option>
              </select>
            </div>
            <Input label="Venue" icon={MapPin} placeholder="e.g. Auditorium A" {...register('venue')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Event Date *" type="datetime-local" icon={CalendarDays} error={errors.event_date?.message} {...register('event_date')} />
            <Input label="Deadline" type="datetime-local" icon={Clock} {...register('registration_deadline')} />
          </div>
          <Input label="Max Slots" type="number" icon={Users} placeholder="Leave empty for unlimited" {...register('max_slots')} />
          <div className="flex items-center gap-3 p-4 bg-amber-50 rounded-xl border border-amber-100">
            <input type="checkbox" id="publish" {...register('publish')} className="w-4 h-4 rounded border-gray-300 text-brand-600" />
            <label htmlFor="publish" className="text-sm">
              <span className="font-medium text-amber-800 flex items-center gap-1.5"><Zap size={14} /> Publish immediately</span>
              <span className="text-amber-600 block text-xs mt-0.5">Opens registration & sends announcement emails</span>
            </label>
          </div>
          <div className="flex gap-3 pt-4">
            <Button variant="ghost" type="button" onClick={() => navigate('/events')}>Cancel</Button>
            <Button type="submit" loading={loading} size="lg" className="flex-1"><CalendarDays size={18} /> Create Event</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
