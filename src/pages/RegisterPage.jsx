import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { User, Mail, Lock, GraduationCap, Building2, Hash, CheckCircle } from 'lucide-react';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import logoImg from '../assets/logo.png';
import { CDM_DEPARTMENTS } from '../lib/departments';

const schema = z.object({
  full_name: z.string()
    .min(2, 'Full name is required')
    .regex(/^[a-zA-Z\s.]*$/, 'Name can only contain letters and spaces'),
  email: z.string().email('Invalid email address'),
  student_id: z.string().regex(/^\d{2}-\d{5}$/, 'Format must be 00-00000'),
  department: z.string().min(1, 'Please select your program'),
  year_level: z.string().min(1, 'Year level is required').refine(val => {
    const n = parseInt(val);
    return n >= 1 && n <= 4;
  }, 'Year level must be between 1 and 4'),
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

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
  });

  const password = watch('password');
  const confirmPassword = watch('confirm_password');
  const isMatch = password && confirmPassword && password === confirmPassword;

  const handleStudentIdChange = (e) => {
    let val = e.target.value.replace(/\D/g, ''); // Remove non-digits
    if (val.length > 7) val = val.slice(0, 7);
    
    if (val.length > 2) {
      val = val.slice(0, 2) + '-' + val.slice(2);
    }
    
    setValue('student_id', val, { shouldValidate: true });
  };

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
              <Input 
                label="Student ID" 
                icon={Hash} 
                placeholder="00-00000" 
                error={errors.student_id?.message} 
                {...register('student_id')}
                onChange={handleStudentIdChange}
              />

            <div className="grid grid-cols-2 gap-4">
              {/* Department/Program Dropdown */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">Department / Program</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Building2 size={18} className="text-gray-400" />
                  </div>
                  <select
                    {...register('department')}
                    className={`block w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm transition-all duration-200 hover:border-gray-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none pl-10 appearance-none ${errors.department ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20' : 'border-gray-300'}`}
                  >
                    <option value="">Select program...</option>
                    {CDM_DEPARTMENTS.map((dept) => (
                      <optgroup key={dept.institute} label={dept.institute}>
                        {dept.programs.map((prog) => (
                          <option key={prog} value={prog}>{prog}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
                {errors.department && <p className="text-xs text-red-500 mt-1">{errors.department.message}</p>}
              </div>

              {/* Year Level Dropdown */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">Year Level</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <GraduationCap size={18} className="text-gray-400" />
                  </div>
                  <select
                    {...register('year_level')}
                    className={`block w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm transition-all duration-200 hover:border-gray-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none pl-10 appearance-none ${errors.year_level ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20' : 'border-gray-300'}`}
                  >
                    <option value="">Year...</option>
                    <option value="1">1st Year</option>
                    <option value="2">2nd Year</option>
                    <option value="3">3rd Year</option>
                    <option value="4">4th Year</option>
                  </select>
                </div>
                {errors.year_level && <p className="text-xs text-red-500 mt-1">{errors.year_level.message}</p>}
              </div>
            </div>

            <Input label="Password" type="password" icon={Lock} placeholder="Min 6 characters" error={errors.password?.message} {...register('password')} />
            
            <div className="relative">
              <Input label="Confirm Password" type="password" icon={Lock} placeholder="Re-enter password" error={errors.confirm_password?.message} {...register('confirm_password')} />
              {isMatch && (
                <div className="absolute right-3 top-[38px] flex items-center gap-1.5 text-green-600 text-xs font-medium animate-fadeIn">
                  <CheckCircle size={14} /> Passwords Match
                </div>
              )}
            </div>

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
