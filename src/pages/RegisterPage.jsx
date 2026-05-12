import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { User, Mail, Lock, GraduationCap, Building2, Hash } from 'lucide-react';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import logoImg from '../assets/logo.png';

const schema = z.object({
  full_name: z.string().min(2, 'Full name is required'),
  email: z.string().email('Invalid email address'),
  student_id: z.string().optional(),
  department: z.string().optional(),
  year_level: z.string().optional(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirm_password: z.string(),
}).refine((d) => d.password === d.confirm_password, {
  message: 'Passwords do not match',
  path: ['confirm_password'],
});

export default function RegisterPage() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register: registerUser } = useAuthStore();
  const navigate = useNavigate();

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data) => {
    setError('');
    setLoading(true);
    try {
      const { confirm_password, year_level, ...rest } = data;
      await registerUser({ ...rest, year_level: year_level ? parseInt(year_level) : undefined });
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-blue-50 p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 bg-white rounded-2xl flex items-center justify-center shadow-xl p-1">
            <img src={logoImg} alt="Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Create your account</h1>
          <p className="text-gray-500 mt-1">Join EVENTLINK CDM and start participating</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm animate-fadeIn">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input label="Full Name" icon={User} placeholder="Juan dela Cruz" error={errors.full_name?.message} {...register('full_name')} />
            <Input label="Email Address" type="email" icon={Mail} placeholder="you@example.com" error={errors.email?.message} {...register('email')} />
            <Input label="Student ID" icon={Hash} placeholder="2024-0001 (optional)" error={errors.student_id?.message} {...register('student_id')} />

            <div className="grid grid-cols-2 gap-4">
              <Input label="Department" icon={Building2} placeholder="e.g. BSIT" error={errors.department?.message} {...register('department')} />
              <Input label="Year Level" icon={GraduationCap} placeholder="e.g. 3" error={errors.year_level?.message} {...register('year_level')} />
            </div>

            <Input label="Password" type="password" icon={Lock} placeholder="Min 6 characters" error={errors.password?.message} {...register('password')} />
            <Input label="Confirm Password" type="password" icon={Lock} placeholder="Re-enter password" error={errors.confirm_password?.message} {...register('confirm_password')} />

            <Button type="submit" loading={loading} className="w-full" size="lg">
              Create Account
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            Already have an account?{' '}
            <Link to="/login" className="text-brand-600 hover:text-brand-700 font-medium">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
