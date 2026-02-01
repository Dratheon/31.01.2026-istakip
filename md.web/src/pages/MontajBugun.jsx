import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import {
  getAssemblyTasksToday,
  startAssemblyTask,
  completeAssemblyTask,
  completeAllAssemblyTasks,
  reportAssemblyIssue,
  resolveAssemblyIssue,
  getTeams,
  uploadDocument,
} from '../services/dataService';

const STATUS_MAP = {
  pending: { label: 'Bekliyor', color: 'var(--text-muted)', icon: '⏳' },
  planned: { label: 'Planlandı', color: 'var(--info)', icon: '📅' },
  in_progress: { label: 'Devam Ediyor', color: 'var(--warning)', icon: '🔧' },
  completed: { label: 'Tamamlandı', color: 'var(--success)', icon: '✅' },
  blocked: { label: 'Beklemede', color: 'var(--danger)', icon: '⛔' },
};

const ISSUE_TYPES = [
  { value: 'broken', label: 'Kırık/Hasarlı' },
  { value: 'missing', label: 'Eksik Malzeme' },
  { value: 'wrong', label: 'Yanlış Ürün' },
  { value: 'damage', label: 'Hasar (Taşıma/Montaj)' },
  { value: 'other', label: 'Diğer' },
];

const FAULT_SOURCES = [
  { value: 'production', label: 'Üretim Hatası (Tedarikçi)' },
  { value: 'team', label: 'Ekip Hatası' },
  { value: 'accident', label: 'Kaza' },
];

const MontajBugun = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState([]);
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState('');
  
  // Modals
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedJob, setSelectedJob] = useState(null);
  
  // Forms
  const [issueForm, setIssueForm] = useState({
    issueType: 'broken',
    item: '',
    quantity: 1,
    faultSource: 'team',
    responsiblePersonId: '',
    photoUrl: '',
    note: '',
    createReplacement: true,
  });
  
  const [completeForm, setCompleteForm] = useState({
    photosBefore: [],
    photosAfter: [],
    customerSignature: '',
    note: '',
  });
  
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, [selectedTeam]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [jobsData, teamsData] = await Promise.all([
        getAssemblyTasksToday(selectedTeam || null),
        getTeams(),
      ]);
      setJobs(jobsData || []);
      setTeams(teamsData || []);
    } catch (err) {
      console.error('Load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStartTask = async (task) => {
    try {
      setActionLoading(true);
      await startAssemblyTask(task.id);
      await loadData();
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCompleteTask = async (task) => {
    try {
      setActionLoading(true);
      await completeAssemblyTask(task.id, {
        photosBefore: completeForm.photosBefore,
        photosAfter: completeForm.photosAfter,
        customerSignature: completeForm.customerSignature,
        note: completeForm.note,
      });
      await loadData();
      setShowCompleteModal(false);
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCompleteAll = async (job) => {
    if (!confirm('Tüm görevleri tek seferde tamamlamak istediğinize emin misiniz?')) return;
    
    try {
      setActionLoading(true);
      await completeAllAssemblyTasks(job.jobId, {
        photosBefore: completeForm.photosBefore,
        photosAfter: completeForm.photosAfter,
        customerSignature: completeForm.customerSignature,
        note: completeForm.note,
      });
      await loadData();
      setShowCompleteModal(false);
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const openIssueModal = (task) => {
    setSelectedTask(task);
    setIssueForm({
      issueType: 'broken',
      item: '',
      quantity: 1,
      faultSource: 'team',
      responsiblePersonId: '',
      photoUrl: '',
      note: '',
      createReplacement: true,
    });
    setShowIssueModal(true);
  };

  const openCompleteModal = (task, job = null) => {
    setSelectedTask(task);
    setSelectedJob(job);
    setCompleteForm({
      photosBefore: [],
      photosAfter: [],
      customerSignature: '',
      note: '',
    });
    setShowCompleteModal(true);
  };

  const handleReportIssue = async () => {
    if (!selectedTask || !issueForm.item) {
      alert('Sorunlu ürün/malzeme adı gerekli');
      return;
    }
    
    try {
      setActionLoading(true);
      await reportAssemblyIssue(selectedTask.id, issueForm);
      await loadData();
      setShowIssueModal(false);
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleResolveIssue = async (task, issueId) => {
    try {
      setActionLoading(true);
      await resolveAssemblyIssue(task.id, issueId);
      await loadData();
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const [uploading, setUploading] = useState(false);
  
  const handleFileUpload = async (e, type) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Hangi job için upload yapılacak
    const jobId = selectedTask?.jobId || selectedJob?.jobId;
    if (!jobId) {
      console.error('No jobId for upload');
      e.target.value = '';
      return;
    }
    
    try {
      setUploading(true);
      
      // Dosya tipini belirle
      let docType = 'montaj';
      let description = 'Montaj fotoğrafı';
      
      if (type === 'before') {
        docType = 'montaj_oncesi';
        description = 'Montaj öncesi fotoğraf';
      } else if (type === 'after') {
        docType = 'montaj_sonrasi';
        description = 'Montaj sonrası fotoğraf';
      } else if (type === 'signature') {
        docType = 'musteri_imza';
        description = 'Müşteri imzası';
      } else if (type === 'issue') {
        docType = 'montaj_sorun';
        description = 'Montaj sorunu fotoğrafı';
      }
      
      // Backend'e yükle
      const result = await uploadDocument(file, jobId, docType, description);
      const url = result?.url || result?.path || URL.createObjectURL(file);
      
      if (type === 'before') {
        setCompleteForm(prev => ({
          ...prev,
          photosBefore: [...prev.photosBefore, url]
        }));
      } else if (type === 'after') {
        setCompleteForm(prev => ({
          ...prev,
          photosAfter: [...prev.photosAfter, url]
        }));
      } else if (type === 'signature') {
        setCompleteForm(prev => ({
          ...prev,
          customerSignature: url
        }));
      } else if (type === 'issue') {
        setIssueForm(prev => ({
          ...prev,
          photoUrl: url
        }));
      }
    } catch (err) {
      console.error('Upload error:', err);
      alert('Dosya yüklenirken hata oluştu: ' + (err.message || err));
    } finally {
      setUploading(false);
    }
    
    e.target.value = '';
  };

  if (loading) {
    return (
      <div>
        <PageHeader title="Bugünkü Montajlar" subtitle="Yükleniyor..." />
        <div className="card subtle-card">Yükleniyor...</div>
      </div>
    );
  }

  const today = new Date().toLocaleDateString('tr-TR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div>
      <PageHeader
        title="Bugünkü Montajlar"
        subtitle={today}
      />

      {/* Ekip Filtresi */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="card-body" style={{ padding: '0.75rem' }}>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <span style={{ fontWeight: 500 }}>Ekip:</span>
            <select
              className="form-control"
              value={selectedTeam}
              onChange={(e) => setSelectedTeam(e.target.value)}
              style={{ width: '200px' }}
            >
              <option value="">Tüm Ekipler</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>{t.ad}</option>
              ))}
            </select>
            <button className="btn btn-secondary" onClick={loadData}>
              🔄 Yenile
            </button>
          </div>
        </div>
      </div>

      {jobs.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📅</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>
            Bugün için planlanmış montaj yok
          </div>
          <div style={{ color: 'var(--text-muted)' }}>
            Planlanan Montajlar sayfasından yeni montaj planlayabilirsiniz.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {jobs.map((job) => {
            const allCompleted = job.tasks.every(t => t.status === 'completed');
            const hasBlocked = job.tasks.some(t => t.status === 'blocked');
            const hasInProgress = job.tasks.some(t => t.status === 'in_progress');
            
            return (
              <div key={job.jobId} className="card" style={{ margin: 0 }}>
                {/* Job Header */}
                <div 
                  className="card-header" 
                  style={{ 
                    background: allCompleted ? 'var(--success)' : hasBlocked ? 'var(--danger)' : hasInProgress ? 'var(--warning)' : 'var(--primary)',
                    color: '#fff'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>
                        🏠 {job.customerName}
                      </div>
                      <div style={{ fontSize: '0.85rem', opacity: 0.9 }}>
                        📍 {job.location || 'Konum belirtilmedi'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {!allCompleted && !hasBlocked && (
                        <button
                          className="btn btn-sm"
                          style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }}
                          onClick={() => openCompleteModal(null, job)}
                        >
                          ✅ Tek Seferde Tamamla
                        </button>
                      )}
                      <button
                        className="btn btn-sm"
                        style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }}
                        onClick={() => navigate(`/isler/list?job=${job.jobId}&stage=5`)}
                      >
                        → İşe Git
                      </button>
                    </div>
                  </div>
                </div>

                {/* Tasks */}
                <div className="card-body" style={{ padding: '1rem' }}>
                  {job.tasks.map((task, idx) => {
                    const status = STATUS_MAP[task.status] || {};
                    const isFirst = idx === 0;
                    const isLast = idx === job.tasks.length - 1;
                    const pendingIssues = task.issues?.filter(i => i.status === 'pending') || [];
                    
                    return (
                      <div 
                        key={task.id}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '1rem',
                          padding: '1rem',
                          background: task.status === 'completed' ? 'rgba(34, 197, 94, 0.1)' : 
                                     task.status === 'blocked' ? 'rgba(239, 68, 68, 0.1)' :
                                     task.status === 'in_progress' ? 'rgba(245, 158, 11, 0.1)' : 'var(--bg-secondary)',
                          borderRadius: 8,
                          marginBottom: idx < job.tasks.length - 1 ? '0.5rem' : 0,
                        }}
                      >
                        {/* Order Number */}
                        <div style={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          background: status.color,
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 600,
                          fontSize: '0.85rem',
                          flexShrink: 0,
                        }}>
                          {task.status === 'completed' ? '✓' : task.stageOrder}
                        </div>

                        {/* Task Info */}
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>
                            {task.roleName} - {task.stageName}
                          </div>
                          
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <span className="badge" style={{ background: status.color, color: '#fff' }}>
                              {status.icon} {status.label}
                            </span>
                            {task.teamName && (
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                👷 {task.teamName}
                              </span>
                            )}
                          </div>

                          {/* Pending Issues */}
                          {pendingIssues.length > 0 && (
                            <div style={{ 
                              padding: '0.5rem', 
                              background: 'rgba(239, 68, 68, 0.1)', 
                              borderRadius: 4,
                              marginBottom: '0.5rem'
                            }}>
                              {pendingIssues.map((issue) => (
                                <div key={issue.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ fontSize: '0.85rem', color: 'var(--danger)' }}>
                                    ⚠️ {issue.item} ({issue.quantity} adet) - {issue.note}
                                  </span>
                                  {issue.replacementOrderId && (
                                    <button
                                      className="btn btn-sm btn-success"
                                      onClick={() => handleResolveIssue(task, issue.id)}
                                      disabled={actionLoading}
                                    >
                                      ✓ Çözüldü
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Photo Requirements */}
                          {isFirst && task.status !== 'completed' && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--info)', marginBottom: '0.25rem' }}>
                              📷 Montaj öncesi fotoğraf zorunlu
                            </div>
                          )}
                          {isLast && task.status !== 'completed' && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--info)' }}>
                              📷 Montaj sonrası fotoğraf ve ✍️ müşteri imzası zorunlu
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          {task.status === 'planned' && (
                            <button
                              className="btn btn-sm btn-primary"
                              onClick={() => handleStartTask(task)}
                              disabled={actionLoading}
                            >
                              ▶️ Başlat
                            </button>
                          )}
                          
                          {task.status === 'in_progress' && (
                            <>
                              <button
                                className="btn btn-sm btn-success"
                                onClick={() => openCompleteModal(task)}
                                disabled={actionLoading || pendingIssues.length > 0}
                                title={pendingIssues.length > 0 ? 'Önce sorunları çözün' : ''}
                              >
                                ✅ Tamamla
                              </button>
                              <button
                                className="btn btn-sm btn-warning"
                                onClick={() => openIssueModal(task)}
                                disabled={actionLoading}
                              >
                                ⚠️ Sorun
                              </button>
                            </>
                          )}
                          
                          {task.status === 'blocked' && pendingIssues.length === 0 && (
                            <button
                              className="btn btn-sm btn-primary"
                              onClick={() => handleStartTask(task)}
                              disabled={actionLoading}
                            >
                              ▶️ Devam Et
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Issue Modal */}
      <Modal
        isOpen={showIssueModal}
        onClose={() => setShowIssueModal(false)}
        title="⚠️ Montaj Sorunu Bildir"
        size="medium"
      >
        {selectedTask && (
          <>
            <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: 6 }}>
              <div><strong>Müşteri:</strong> {selectedTask.customerName}</div>
              <div><strong>Görev:</strong> {selectedTask.roleName} - {selectedTask.stageName}</div>
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Sorun Türü *</label>
                <select
                  className="form-control"
                  value={issueForm.issueType}
                  onChange={(e) => setIssueForm({ ...issueForm, issueType: e.target.value })}
                >
                  {ISSUE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Adet *</label>
                <input
                  type="number"
                  className="form-control"
                  value={issueForm.quantity}
                  onChange={(e) => setIssueForm({ ...issueForm, quantity: parseInt(e.target.value) || 1 })}
                  min={1}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Sorunlu Ürün/Malzeme *</label>
              <input
                type="text"
                className="form-control"
                value={issueForm.item}
                onChange={(e) => setIssueForm({ ...issueForm, item: e.target.value })}
                placeholder="Örn: Cam 80x120"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Hata Kaynağı *</label>
              <select
                className="form-control"
                value={issueForm.faultSource}
                onChange={(e) => setIssueForm({ ...issueForm, faultSource: e.target.value })}
              >
                {FAULT_SOURCES.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">📷 Fotoğraf (Zorunlu)</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleFileUpload(e, 'issue')}
                className="form-control"
              />
              {issueForm.photoUrl && (
                <img 
                  src={issueForm.photoUrl} 
                  alt="Sorun fotoğrafı" 
                  style={{ maxWidth: 200, marginTop: '0.5rem', borderRadius: 4 }}
                />
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Açıklama</label>
              <textarea
                className="form-control"
                value={issueForm.note}
                onChange={(e) => setIssueForm({ ...issueForm, note: e.target.value })}
                rows={2}
                placeholder="Ne oldu? Nasıl oldu?"
              />
            </div>

            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  checked={issueForm.createReplacement}
                  onChange={(e) => setIssueForm({ ...issueForm, createReplacement: e.target.checked })}
                />
                Yedek sipariş oluştur (Üretim Takip'e düşer)
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.5rem' }}>
              <button className="btn btn-ghost" onClick={() => setShowIssueModal(false)}>
                İptal
              </button>
              <button 
                className="btn btn-danger" 
                onClick={handleReportIssue}
                disabled={actionLoading || !issueForm.item || !issueForm.photoUrl}
              >
                {actionLoading ? 'Kaydediliyor...' : '⚠️ Sorunu Bildir'}
              </button>
            </div>
          </>
        )}
      </Modal>

      {/* Complete Modal */}
      <Modal
        isOpen={showCompleteModal}
        onClose={() => setShowCompleteModal(false)}
        title={selectedJob ? "✅ Tüm Görevleri Tamamla" : "✅ Görevi Tamamla"}
        size="medium"
      >
        <div style={{ marginBottom: '1rem' }}>
          {selectedTask && (
            <div style={{ padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: 6 }}>
              <div><strong>Görev:</strong> {selectedTask.roleName} - {selectedTask.stageName}</div>
            </div>
          )}
          {selectedJob && (
            <div style={{ padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: 6 }}>
              <div><strong>Müşteri:</strong> {selectedJob.customerName}</div>
              <div><strong>Tamamlanacak Görev:</strong> {selectedJob.tasks.length} adet</div>
            </div>
          )}
        </div>

        <div className="form-group">
          <label className="form-label">📷 Montaj Öncesi Fotoğraf (Zorunlu)</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => handleFileUpload(e, 'before')}
            className="form-control"
          />
          {completeForm.photosBefore.length > 0 && (
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
              {completeForm.photosBefore.map((url, i) => (
                <img key={i} src={url} alt="Öncesi" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 4 }} />
              ))}
            </div>
          )}
        </div>

        <div className="form-group">
          <label className="form-label">📷 Montaj Sonrası Fotoğraf (Zorunlu)</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => handleFileUpload(e, 'after')}
            className="form-control"
          />
          {completeForm.photosAfter.length > 0 && (
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
              {completeForm.photosAfter.map((url, i) => (
                <img key={i} src={url} alt="Sonrası" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 4 }} />
              ))}
            </div>
          )}
        </div>

        <div className="form-group">
          <label className="form-label">✍️ Müşteri İmzası (Zorunlu)</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => handleFileUpload(e, 'signature')}
            className="form-control"
          />
          {completeForm.customerSignature && (
            <img 
              src={completeForm.customerSignature} 
              alt="İmza" 
              style={{ maxWidth: 200, marginTop: '0.5rem', borderRadius: 4 }}
            />
          )}
        </div>

        <div className="form-group">
          <label className="form-label">Not (Opsiyonel)</label>
          <textarea
            className="form-control"
            value={completeForm.note}
            onChange={(e) => setCompleteForm({ ...completeForm, note: e.target.value })}
            rows={2}
            placeholder="Ek notlar..."
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.5rem' }}>
          <button className="btn btn-ghost" onClick={() => setShowCompleteModal(false)}>
            İptal
          </button>
          <button 
            className="btn btn-success" 
            onClick={() => selectedJob ? handleCompleteAll(selectedJob) : handleCompleteTask(selectedTask)}
            disabled={actionLoading || 
              completeForm.photosBefore.length === 0 || 
              completeForm.photosAfter.length === 0 || 
              !completeForm.customerSignature
            }
          >
            {actionLoading ? 'Kaydediliyor...' : '✅ Tamamla'}
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default MontajBugun;
