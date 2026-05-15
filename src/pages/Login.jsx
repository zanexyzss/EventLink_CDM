import { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import logoImg from '../assets/logo.png';
import bgImg from '../assets/bg.png';

const schema = z.object({
  email: z.string()
    .min(1, 'Email address is required')
    .email('Please enter a valid email address (e.g. you@example.com)'),
  password: z.string()
    .min(1, 'Password is required')
});

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname + (location.state?.from?.search || '') || '/dashboard';

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data) => {
    setError('');
    setLoading(true);
    try {
      await login(data.email, data.password);
      navigate(from, { replace: true });
    } catch (err) {
      const msg = err.response?.data?.error;
      if (msg === 'Invalid credentials') {
        setError('Incorrect email or password. Please try again.');
      } else if (msg) {
        setError(msg);
      } else {
        setError('Login failed. Please check your connection and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left — Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden items-center justify-center p-12">
        <div className="absolute inset-0">
          <img src={bgImg} alt="Colegio de Montalban" className="w-full h-full object-cover opacity-40 mix-blend-overlay" />
          <div className="absolute inset-0 bg-brand-900/90 mix-blend-multiply" />
        </div>
        <div className="relative z-10 text-center">
          <div className="w-24 h-24 mx-auto mb-8 bg-white rounded-full flex items-center justify-center shadow-2xl p-2">
            <img src={logoImg} alt="Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-5xl font-bold text-white mb-4 tracking-tight">EVENTLINK</h1>
          <div className="text-amber-400 text-sm tracking-[0.4em] font-medium mb-8">CDM</div>
          <p className="text-brand-200 text-lg max-w-sm mx-auto leading-relaxed">
            Your centralized campus event management platform. Discover, register, and participate seamlessly.
          </p>
        </div>
      </div>

      {/* Right — Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-gray-50">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-10 justify-center">
            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-md p-1">
              <img src={logoImg} alt="Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-brand-800">EVENTLINK</h1>
              <p className="text-[10px] tracking-[0.3em] text-brand-600">CDM</p>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome back</h2>
          <p className="text-gray-500 mb-8">Sign in to access your account</p>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm animate-fadeIn">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <Input
              label="Email Address"
              type="email"
              icon={Mail}
              placeholder="you@example.com"
              error={errors.email?.message}
              {...register('email')}
            />

            <div className="relative">
              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                icon={Lock}
                placeholder="Enter your password"
                error={errors.password?.message}
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-[38px] text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <div className="flex justify-end">
              <Link to="/forgot-password" className="text-sm font-medium text-brand-600 hover:text-brand-700 transition-colors">
                Forgot password?
              </Link>
            </div>

            <Button type="submit" loading={loading} className="w-full" size="lg">
              Sign In
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            Don't have an account?{' '}
            <Link to="/register" className="text-brand-600 hover:text-brand-700 font-medium">
              Create account
            </Link>
          </p>

          
        </div>
      </div>
    </div>
  );
}
