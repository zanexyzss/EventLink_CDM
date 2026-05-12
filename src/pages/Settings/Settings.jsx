import { useState, useEffect } from 'react';
import { useToastStore } from '../../store/toastStore';
import { useAuthStore } from '../../store/authStore';
import api from '../../lib/api';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Spinner from '../../components/ui/Spinner';
import { Mail, Building2, Save, Send, CheckCircle } from 'lucide-react';

export default function Settings() {
  const toast = useToastStore();
  const { user } = useAuthStore();
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [emailStatus, setEmailStatus] = useState(null);

  useEffect(() => { loadSettings(); }, []);

  const loadSettings = async () => {
    try {
      const { data } = await api.get('/settings');
      setSettings(data.data || {});
    } catch (err) {
      toast.error('Failed to load settings');
    } finally { setLoading(false); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/settings', settings);
      toast.success('Settings saved! ✅');
    } catch (err) {
      toast.error('Failed to save settings');
    } finally { setSaving(false); }
  };

  const handleTestEmail = async () => {
    setTesting(true);
    setEmailStatus(null);
    try {
      toast.info('Sending test email via Gmail SMTP...');
      const { data } = await api.post('/settings/test-email', {
        recipient: testEmail || undefined
      });
      toast.success(data.message || 'Test email sent! Check your inbox.');
      setEmailStatus('success');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Test email failed. Check .env SMTP credentials.');
      setEmailStatus('failed');
    } finally { setTesting(false); }
  };

  const updateSetting = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fadeIn">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 mt-1">Configure system and email settings</p>
      </div>

      {/* Institution Settings */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Building2 size={20} className="text-brand-600" /> Institution
        </h2>
        <div className="space-y-4">
          <Input label="App Name" value={settings.app_name || ''} onChange={(e) => updateSetting('app_name', e.target.value)} placeholder="EVENTLINK CDM" />
          <Input label="Institution Name" value={settings.institution_name || ''} onChange={(e) => updateSetting('institution_name', e.target.value)} placeholder="CDM" />
        </div>
      </div>

      {/* Email Settings */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Mail size={20} className="text-brand-600" /> Email Configuration
        </h2>
        <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl mb-4">
          <p className="text-sm text-blue-700">
            <strong>Gmail SMTP Active.</strong> Credentials are in <code className="bg-blue-100 px-1.5 py-0.5 rounded text-xs">.env</code>. To change, update EMAIL_USER and EMAIL_PASS, then restart the server.
          </p>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="SMTP Host" value="smtp.gmail.com" disabled />
            <Input label="SMTP Port" value="587" disabled />
          </div>
          <Input label="Sender Email" value="zannesioson@gmail.com" disabled />

          <div className="border-t border-gray-100 pt-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Send size={14} /> Send Test Email
            </h3>
            <div className="flex gap-3">
              <div className="flex-1">
                <Input
                  label="Recipient Email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="Enter email to receive test..."
                />
              </div>
              <div className="flex items-end">
                <Button variant="secondary" onClick={handleTestEmail} loading={testing}>
                  <Send size={16} /> Send Test
                </Button>
              </div>
            </div>
            {emailStatus === 'success' && (
              <div className="mt-3 p-3 bg-green-50 border border-green-100 rounded-xl flex items-center gap-2">
                <CheckCircle size={16} className="text-green-600" />
                <p className="text-sm text-green-700">Email sent successfully! Check the inbox (and spam folder).</p>
              </div>
            )}
            {emailStatus === 'failed' && (
              <div className="mt-3 p-3 bg-red-50 border border-red-100 rounded-xl">
                <p className="text-sm text-red-700">Email failed. Verify your Gmail App Password in .env and ensure 2FA is enabled on your Google account.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Save */}
      <div className="flex justify-end">
        <Button onClick={handleSave} loading={saving} size="lg">
          <Save size={18} /> Save Settings
        </Button>
      </div>
    </div>
  );
}
