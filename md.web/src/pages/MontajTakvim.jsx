import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import DateInput from '../components/DateInput';
import {
  getAssemblyTasks,
  updateAssemblyTask,
  getTeams,
} from '../services/dataService';

const STATUS_COLORS = {
  pending: 'var(--text-muted)',
  planned: 'var(--info)',
  in_progress: 'var(--warning)',
  completed: 'var(--success)',
  blocked: 'var(--danger)',
};

const MontajTakvim = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState([]);
  const [teams, setTeams] = useState([]);
  
  // View
  const [viewMode, setViewMode] = useState('month'); // month | week
  const [currentDate, setCurrentDate] = useState(new Date());
  const [teamFilter, setTeamFilter] = useState('');
  
  // Drag & Drop
  const [draggedTask, setDraggedTask] = useState(null);
  
  // Modal
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [tasksData, teamsData] = await Promise.all([
        getAssemblyTasks({}),
        getTeams(),
      ]);
      setTasks(tasksData || []);
      setTeams(teamsData || []);
    } catch (err) {
      console.error('Load error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Takvim günleri
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    if (viewMode === 'month') {
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      const startDay = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1; // Pazartesi = 0
      
      const days = [];
      
      // Önceki ayın günleri
      for (let i = startDay - 1; i >= 0; i--) {
        const d = new Date(year, month, -i);
        days.push({ date: d, isCurrentMonth: false });
      }
      
      // Bu ayın günleri
      for (let i = 1; i <= lastDay.getDate(); i++) {
        days.push({ date: new Date(year, month, i), isCurrentMonth: true });
      }
      
      // Sonraki ayın günleri (6 satır doldurmak için)
      const remaining = 42 - days.length;
      for (let i = 1; i <= remaining; i++) {
        days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
      }
      
      return days;
    } else {
      // Haftalık görünüm
      const startOfWeek = new Date(currentDate);
      const day = startOfWeek.getDay() === 0 ? 6 : startOfWeek.getDay() - 1;
      startOfWeek.setDate(startOfWeek.getDate() - day);
      
      const days = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(startOfWeek);
        d.setDate(startOfWeek.getDate() + i);
        days.push({ date: d, isCurrentMonth: true });
      }
      return days;
    }
  }, [currentDate, viewMode]);

  // Görevleri tarihe göre grupla
  const tasksByDate = useMemo(() => {
    const map = {};
    
    for (const task of tasks) {
      if (!task.plannedDate) continue;
      if (teamFilter && task.teamId !== teamFilter) continue;
      
      const dateKey = task.plannedDate.slice(0, 10);
      if (!map[dateKey]) map[dateKey] = [];
      map[dateKey].push(task);
    }
    
    return map;
  }, [tasks, teamFilter]);

  const formatDateKey = (date) => {
    return date.toISOString().slice(0, 10);
  };

  const handleDragStart = (e, task) => {
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e, date) => {
    e.preventDefault();
    if (!draggedTask) return;
    
    const newDate = formatDateKey(date);
    
    // Termin kontrolü
    if (draggedTask.estimatedDate) {
      const estimated = new Date(draggedTask.estimatedDate);
      if (date > estimated) {
        if (!confirm('Bu tarih müşteri termininden sonra. Devam etmek istiyor musunuz?')) {
          setDraggedTask(null);
          return;
        }
      }
    }
    
    try {
      await updateAssemblyTask(draggedTask.id, {
        plannedDate: newDate,
        status: 'planned',
      });
      await loadData();
    } catch (err) {
      alert(err.message);
    }
    
    setDraggedTask(null);
  };

  const openTaskDetail = (task) => {
    setSelectedTask(task);
    setShowDetailModal(true);
  };

  const prevPeriod = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'month') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setDate(newDate.getDate() - 7);
    }
    setCurrentDate(newDate);
  };

  const nextPeriod = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'month') {
      newDate.setMonth(newDate.getMonth() + 1);
    } else {
      newDate.setDate(newDate.getDate() + 7);
    }
    setCurrentDate(newDate);
  };

  const goToday = () => {
    setCurrentDate(new Date());
  };

  if (loading) {
    return (
      <div>
        <PageHeader title="Montaj Takvimi" subtitle="Yükleniyor..." />
        <div className="card subtle-card">Yükleniyor...</div>
      </div>
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const weekDays = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

  return (
    <div>
      <PageHeader
        title="Montaj Takvimi"
        subtitle={currentDate.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })}
      />

      {/* Controls */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="card-body" style={{ padding: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn btn-ghost" onClick={prevPeriod}>← Önceki</button>
              <button className="btn btn-secondary" onClick={goToday}>Bugün</button>
              <button className="btn btn-ghost" onClick={nextPeriod}>Sonraki →</button>
            </div>
            
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                className={`btn ${viewMode === 'month' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setViewMode('month')}
              >
                Aylık
              </button>
              <button
                className={`btn ${viewMode === 'week' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setViewMode('week')}
              >
                Haftalık
              </button>
            </div>
            
            <select
              className="form-control"
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              style={{ width: '150px' }}
            >
              <option value="">Tüm Ekipler</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>{t.ad}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Calendar */}
      <div className="card">
        <div className="card-body" style={{ padding: '0.5rem' }}>
          {/* Header */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(7, 1fr)', 
            gap: '2px',
            marginBottom: '2px'
          }}>
            {weekDays.map((day) => (
              <div 
                key={day} 
                style={{ 
                  padding: '0.5rem', 
                  textAlign: 'center', 
                  fontWeight: 600,
                  background: 'var(--bg-secondary)',
                  borderRadius: 4
                }}
              >
                {day}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(7, 1fr)', 
            gap: '2px'
          }}>
            {calendarDays.map((dayInfo, idx) => {
              const dateKey = formatDateKey(dayInfo.date);
              const dayTasks = tasksByDate[dateKey] || [];
              const isToday = dateKey === today;
              const isWeekend = [5, 6].includes(idx % 7);
              
              return (
                <div
                  key={dateKey}
                  style={{
                    minHeight: viewMode === 'week' ? '300px' : '120px',
                    padding: '0.25rem',
                    background: isToday ? 'rgba(59, 130, 246, 0.1)' : 
                               !dayInfo.isCurrentMonth ? 'var(--bg-secondary)' :
                               isWeekend ? 'rgba(0,0,0,0.02)' : 'transparent',
                    border: isToday ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                    borderRadius: 4,
                    opacity: dayInfo.isCurrentMonth ? 1 : 0.5,
                    overflow: 'hidden',
                  }}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, dayInfo.date)}
                >
                  {/* Date Number */}
                  <div style={{ 
                    fontSize: '0.75rem', 
                    fontWeight: isToday ? 700 : 500,
                    color: isToday ? 'var(--primary)' : 'inherit',
                    marginBottom: '0.25rem'
                  }}>
                    {dayInfo.date.getDate()}
                  </div>

                  {/* Tasks */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    {dayTasks.slice(0, viewMode === 'week' ? 20 : 3).map((task) => (
                      <div
                        key={task.id}
                        draggable={task.status !== 'completed'}
                        onDragStart={(e) => handleDragStart(e, task)}
                        onClick={() => openTaskDetail(task)}
                        style={{
                          padding: '2px 4px',
                          background: STATUS_COLORS[task.status] || 'var(--primary)',
                          color: '#fff',
                          borderRadius: 3,
                          fontSize: '0.65rem',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                        title={`${task.customerName} - ${task.roleName}`}
                      >
                        {task.customerName?.split(' ')[0]} • {task.roleName?.slice(0, 6)}
                      </div>
                    ))}
                    
                    {dayTasks.length > (viewMode === 'week' ? 20 : 3) && (
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                        +{dayTasks.length - (viewMode === 'week' ? 20 : 3)} daha
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Planlanmamış Görevler */}
      <div className="card" style={{ marginTop: '1rem' }}>
        <div className="card-header">
          <h3 style={{ margin: 0 }}>⏳ Planlanmamış Görevler</h3>
        </div>
        <div className="card-body" style={{ padding: '0.75rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {tasks
              .filter(t => !t.plannedDate && t.status !== 'completed')
              .filter(t => !teamFilter || t.teamId === teamFilter)
              .slice(0, 20)
              .map((task) => (
                <div
                  key={task.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, task)}
                  onClick={() => openTaskDetail(task)}
                  style={{
                    padding: '0.5rem 0.75rem',
                    background: task.isOverdue ? 'rgba(239, 68, 68, 0.1)' : 'var(--bg-secondary)',
                    border: task.isOverdue ? '1px solid var(--danger)' : '1px solid var(--border-color)',
                    borderRadius: 6,
                    fontSize: '0.85rem',
                    cursor: 'grab',
                  }}
                  title={`Sürükleyip takvime bırakın`}
                >
                  <div style={{ fontWeight: 500 }}>{task.customerName}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {task.roleName} - {task.stageName}
                  </div>
                  {task.estimatedDate && (
                    <div style={{ 
                      fontSize: '0.7rem', 
                      color: task.isOverdue ? 'var(--danger)' : 'var(--info)',
                      marginTop: '0.25rem'
                    }}>
                      📅 Termin: {new Date(task.estimatedDate).toLocaleDateString('tr-TR')}
                      {task.isOverdue && ' ⚠️'}
                    </div>
                  )}
                </div>
              ))}
            
            {tasks.filter(t => !t.plannedDate && t.status !== 'completed').length === 0 && (
              <div style={{ color: 'var(--text-muted)', padding: '1rem' }}>
                Tüm görevler planlandı 🎉
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Task Detail Modal */}
      <Modal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title="Montaj Görevi Detayı"
        size="medium"
      >
        {selectedTask && (
          <div>
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              <div><strong>Müşteri:</strong> {selectedTask.customerName}</div>
              <div><strong>Konum:</strong> {selectedTask.location || '—'}</div>
              <div><strong>İş Kolu:</strong> {selectedTask.roleName}</div>
              <div><strong>Aşama:</strong> {selectedTask.stageName}</div>
              <div><strong>Ekip:</strong> {selectedTask.teamName || 'Atanmadı'}</div>
              <div><strong>Planlanan Tarih:</strong> {selectedTask.plannedDate ? new Date(selectedTask.plannedDate).toLocaleDateString('tr-TR') : 'Planlanmadı'}</div>
              <div><strong>Müşteri Termini:</strong> {selectedTask.estimatedDate ? new Date(selectedTask.estimatedDate).toLocaleDateString('tr-TR') : '—'}</div>
              <div>
                <strong>Durum:</strong>{' '}
                <span 
                  className="badge" 
                  style={{ background: STATUS_COLORS[selectedTask.status], color: '#fff' }}
                >
                  {selectedTask.status}
                </span>
              </div>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.5rem' }}>
              <button className="btn btn-ghost" onClick={() => setShowDetailModal(false)}>
                Kapat
              </button>
              <button 
                className="btn btn-primary"
                onClick={() => {
                  setShowDetailModal(false);
                  navigate(`/isler/list?job=${selectedTask.jobId}&stage=5`);
                }}
              >
                → İşe Git
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default MontajTakvim;
