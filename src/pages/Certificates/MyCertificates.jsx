import { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useToastStore } from '../../store/toastStore';
import api from '../../lib/api';
import Button from '../../components/ui/Button';
import Spinner from '../../components/ui/Spinner';
import { Award, Download, Calendar, MapPin, FileText } from 'lucide-react';
import { safeFormat } from '../../lib/dateUtils';

export default function MyCertificates() {
  const { user } = useAuthStore();
  const toast = useToastStore();
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(null);

  useEffect(() => { loadCertificates(); }, []);

  const loadCertificates = async () => {
    try {
      const { data } = await api.get('/certificates/mine');
      setCertificates(data.data || []);
    } catch (err) {
      toast.error('Failed to load certificates');
    } finally { setLoading(false); }
  };

  const handleDownload = async (cert) => {
    setDownloading(cert.id);
    try {
      const response = await api.get(`/certificates/${cert.event_id}/download/${user.id}`, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `Certificate_${cert.title?.replace(/\s+/g, '_') || 'EventLink'}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('Certificate downloaded! 📄');
    } catch (err) {
      toast.error('Download failed. Certificate may not be generated yet.');
    } finally { setDownloading(null); }
  };

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fadeIn">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">My Certificates</h1>
        <p className="text-gray-500 mt-1">Download your earned certificates from completed events.</p>
      </div>

      {certificates.length > 0 ? (
        <div className="space-y-4">
          {certificates.map((cert) => (
            <div key={cert.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-yellow-600 rounded-xl flex items-center justify-center shadow-md flex-shrink-0">
                    <Award size={22} className="text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-lg">{cert.title || 'Event Certificate'}</h3>
                    <div className="flex flex-wrap items-center gap-3 mt-1.5 text-sm text-gray-500">
                      {cert.event_date && (
                        <span className="flex items-center gap-1">
                          <Calendar size={13} />{safeFormat(cert.event_date, 'MMMM d, yyyy')}
                        </span>
                      )}
                      {cert.generated_at && (
                        <span className="flex items-center gap-1">
                          <FileText size={13} />Generated {safeFormat(cert.generated_at, 'MMM d')}
                        </span>
                      )}
                    </div>
                    {cert.sent_via_email ? (
                      <span className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 bg-green-50 text-green-700 rounded-full text-xs font-medium">
                        ✉️ Emailed to you
                      </span>
                    ) : null}
                  </div>
                </div>
                <Button
                  onClick={() => handleDownload(cert)}
                  loading={downloading === cert.id}
                  variant="secondary"
                  size="sm"
                >
                  <Download size={14} /> Download PDF
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <Award size={56} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-semibold text-gray-600">No certificates yet</h3>
          <p className="text-gray-400 mt-2 text-sm max-w-sm mx-auto">
            Certificates will appear here once you attend events and the organizer generates them.
          </p>
        </div>
      )}
    </div>
  );
}
