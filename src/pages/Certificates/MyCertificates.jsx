import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useToastStore } from '../../store/toastStore';
import api from '../../lib/api';
import Button from '../../components/ui/Button';
import Spinner from '../../components/ui/Spinner';
import Modal from '../../components/ui/Modal';
import { Award, Download, Calendar, MapPin, FileText, Edit3, CheckCircle, AlertTriangle } from 'lucide-react';
import { safeFormat } from '../../lib/dateUtils';

export default function MyCertificates() {
  const { user } = useAuthStore();
  const toast = useToastStore();
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(null);

  // Name verification modal
  const [verifyTarget, setVerifyTarget] = useState(null);
  const [verifyName, setVerifyName] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [searchParams] = useSearchParams();
  const autoVerifyHandled = useRef(false);

  useEffect(() => { loadCertificates(); }, []);

  // Auto-open verify modal when redirected from email with ?verify=EVENT_ID
  useEffect(() => {
    if (autoVerifyHandled.current) return;
    const verifyEventId = searchParams.get('verify');
    if (verifyEventId && certificates.length > 0) {
      const cert = certificates.find(c => c.event_id === parseInt(verifyEventId));
      if (cert && cert.verification_status !== 'verified') {
        openVerify(cert);
        autoVerifyHandled.current = true;
      }
    }
  }, [certificates, searchParams]);

  const loadCertificates = async () => {
    try {
      const { data } = await api.get('/certificates/mine');
      setCertificates(data.data || []);
    } catch (err) {
      toast.error('Failed to load certificates');
    } finally { setLoading(false); }
  };

  const handleDownload = async (cert) => {
    // Block download if not verified
    if (cert.verification_status !== 'verified') {
      toast.error('Please verify your name on the certificate first.');
      openVerify(cert);
      return;
    }

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
      const msg = err.response?.data?.error || 'Download failed.';
      toast.error(msg);
    } finally { setDownloading(null); }
  };

  const openVerify = (cert) => {
    setVerifyTarget(cert);
    setVerifyName(cert.cert_name_override || user.full_name);
  };

  const handleVerify = async () => {
    if (!verifyTarget) return;
    setVerifying(true);
    try {
      await api.put(`/certificates/${verifyTarget.event_id}/verify-name`, {
        cert_name_override: verifyName.trim() || undefined,
      });
      toast.success('Name verified and certificate updated! ✅');
      setVerifyTarget(null);
      loadCertificates();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to verify');
    } finally { setVerifying(false); }
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
          {certificates.map((cert) => {
            const isVerified = cert.verification_status === 'verified';
            const isPending = !isVerified;

            return (
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

                      {/* Verification Status */}
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {isVerified ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-50 text-green-700 rounded-full text-xs font-medium">
                            <CheckCircle size={12} /> Name Verified
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 rounded-full text-xs font-medium">
                            <AlertTriangle size={12} /> Please verify your name
                          </span>
                        )}
                        {cert.sent_via_email ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 rounded-full text-xs font-medium">
                            ✉️ Emailed to you
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 flex-shrink-0">
                    {/* Verify / Edit Name Button */}
                    {isPending && (
                      <Button
                        onClick={() => openVerify(cert)}
                        variant="secondary"
                        size="sm"
                        className="!bg-amber-50 !text-amber-700 !border-amber-200 hover:!bg-amber-100"
                      >
                        <Edit3 size={14} /> Verify Name
                      </Button>
                    )}
                    {isVerified && (
                      <Button
                        onClick={() => openVerify(cert)}
                        variant="ghost"
                        size="sm"
                      >
                        <Edit3 size={14} /> Edit Name
                      </Button>
                    )}

                    {/* Download */}
                    <Button
                      onClick={() => handleDownload(cert)}
                      loading={downloading === cert.id}
                      variant={isVerified ? 'secondary' : 'ghost'}
                      size="sm"
                      disabled={isPending}
                    >
                      <Download size={14} /> Download PDF
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
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

      {/* ─── Verify Name Modal ─── */}
      <Modal isOpen={!!verifyTarget} onClose={() => setVerifyTarget(null)} title="Verify Your Name">
        {verifyTarget && (
          <div className="space-y-5">
            <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
              <p className="text-sm text-blue-700">
                Please confirm the name that will appear on your certificate for <strong>{verifyTarget.title}</strong>.
                If the name below is incorrect, you may edit it. Once verified, you can download your certificate.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">Your Name on the Certificate</label>
              <input
                type="text"
                value={verifyName}
                onChange={(e) => setVerifyName(e.target.value)}
                placeholder="Enter your full name"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-base focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
              />
              <p className="text-xs text-gray-400">This is the name that will be printed on the PDF certificate.</p>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <Button variant="ghost" onClick={() => setVerifyTarget(null)}>Cancel</Button>
              <Button onClick={handleVerify} loading={verifying} disabled={!verifyName.trim()}>
                <CheckCircle size={16} /> Confirm & Verify
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
