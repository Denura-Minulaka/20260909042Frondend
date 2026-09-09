import React, { useState, useEffect } from 'react';
import './App.css';

const API = 'http://localhost:8082/api/v1';

// ─── Toast Component ──────────────────────────────────────────────
function Toast({ toast }) {
  if (!toast) return null;
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  return (
    <div className="toast-container">
      <div className={`toast toast-${toast.type}`}>
        <span className="toast-icon">{icons[toast.type] || 'ℹ️'}</span>
        <span>{toast.message}</span>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────
export default function App() {
  const [token, setToken] = useState(localStorage.getItem('jwt_token') || '');
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user_info')) || null);
  const [activeTab, setActiveTab] = useState('trainings');
  const [toast, setToast] = useState(null);

  // Data
  const [trainings, setTrainings] = useState([]);
  const [officers, setOfficers] = useState([]);
  const [nominations, setNominations] = useState([]);
  const [waitingList, setWaitingList] = useState([]);
  const [selectedTrainingId, setSelectedTrainingId] = useState('');

  // Nominate form
  const [nominateOfficerId, setNominateOfficerId] = useState('');

  // Editing state
  const [editingTrainingId, setEditingTrainingId] = useState(null);

  // Create/Update training form
  const [newTraining, setNewTraining] = useState({
    title: '', description: '', trainingDate: '',
    maxParticipants: 40, venueId: 1, trainerId: 1, targetDepartmentIds: [1, 2],
    minYearsOfService: 0, requiredGrade: ''
  });

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 6000);
  };

  const authFetch = (url, opts = {}) => {
    opts.headers = { ...(opts.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) };
    return fetch(url, opts);
  };

  useEffect(() => {
    fetchTrainings();
    fetchOfficers();
  }, [token]);

  useEffect(() => {
    if (!selectedTrainingId) return;
    if (activeTab === 'nominations') fetchNominations(selectedTrainingId);
    if (activeTab === 'waiting')    fetchWaitingList(selectedTrainingId);
  }, [selectedTrainingId, activeTab]);

  // ── Auth ──────────────────────────────────────────────────────
  const loginPreset = async (email, password) => {
    try {
      const res  = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (res.ok && data.data?.token) {
        const u = {
          userId: data.data.userId, fullName: data.data.fullName,
          email: data.data.email, role: data.data.role,
          departmentName: data.data.departmentName,
        };
        setToken(data.data.token);
        setUser(u);
        localStorage.setItem('jwt_token', data.data.token);
        localStorage.setItem('user_info', JSON.stringify(u));
        showToast(`Logged in as ${u.fullName} (${u.role})`, 'success');
        fetchTrainings();
        fetchOfficers();
      } else {
        showToast(data.message || 'Login failed. Check backend is running on port 8082.', 'error');
      }
    } catch {
      showToast('Cannot reach backend. Make sure Spring Boot is running on port 8082.', 'error');
    }
  };

  const logout = () => {
    setToken(''); setUser(null);
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('user_info');
    showToast('Logged out', 'info');
  };

  // ── Officers & Trainings ──────────────────────────────────────
  const fetchOfficers = async () => {
    try {
      const res = await fetch(`${API}/users/officers`);
      const data = await res.json();
      if (res.ok && data.data) {
        setOfficers(data.data);
        if (data.data.length > 0 && !nominateOfficerId) {
          setNominateOfficerId(String(data.data[0].id));
        }
      }
    } catch (err) {
      console.error('Error fetching officers:', err);
    }
  };

  const fetchTrainings = async () => {
    try {
      const res  = await authFetch(`${API}/trainings`);
      const data = await res.json();
      if (res.ok && data.data) {
        setTrainings(data.data);
        if (data.data.length && !selectedTrainingId)
          setSelectedTrainingId(String(data.data[0].id));
      }
    } catch { /* silent */ }
  };

  const handleEditClick = (t) => {
    setEditingTrainingId(t.id);
    setNewTraining({
      title: t.title || '',
      description: t.description || '',
      trainingDate: t.trainingDate || '',
      maxParticipants: t.maxParticipants || 40,
      venueId: 1, trainerId: 1,
      targetDepartmentIds: [1, 2],
      minYearsOfService: t.minYearsOfService || 0,
      requiredGrade: t.requiredGrade || ''
    });
    setActiveTab('create-training');
    showToast(`Editing "${t.title}". Update fields and click Save.`, 'info');
  };

  const handleCancelEdit = () => {
    setEditingTrainingId(null);
    setNewTraining({
      title: '', description: '', trainingDate: '', maxParticipants: 40,
      venueId: 1, trainerId: 1, targetDepartmentIds: [1, 2],
      minYearsOfService: 0, requiredGrade: ''
    });
  };

  const handleCreateOrUpdateTraining = async (e) => {
    e.preventDefault();
    if (!token) return showToast('Please login as Coordinator first', 'error');
    try {
      const payload = {
        ...newTraining,
        maxParticipants: parseInt(newTraining.maxParticipants),
        minYearsOfService: parseInt(newTraining.minYearsOfService) || 0
      };

      const isEditing = editingTrainingId !== null;
      const url = isEditing ? `${API}/trainings/${editingTrainingId}` : `${API}/trainings`;
      const method = isEditing ? 'PUT' : 'POST';

      const res  = await authFetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (res.ok) {
        showToast(isEditing ? `Training "${data.data.title}" updated successfully!` : `Training "${data.data.title}" created successfully!`, 'success');
        fetchTrainings();
        handleCancelEdit();
        setActiveTab('trainings');
      } else {
        showToast(data.message || 'Failed to save training', 'error');
      }
    } catch (err) { showToast(`Network error: ${err.message}`, 'error'); }
  };

  // ── Nominations ───────────────────────────────────────────────
  const handleNominate = async (e) => {
    e.preventDefault();
    if (!token) return showToast('Please login first', 'error');
    if (!selectedTrainingId) return showToast('Select a training programme first', 'warning');
    try {
      const res  = await authFetch(`${API}/trainings/${selectedTrainingId}/nominations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ officerId: parseInt(nominateOfficerId) }),
      });
      const data = await res.json();
      if (res.status === 201) {
        const s = data.data.status;
        if (s === 'CONFIRMED')    showToast(`✅ Nomination CONFIRMED for ${data.data.officerName}`, 'success');
        else if (s === 'WAITING_LIST') showToast(`⏳ Capacity full — ${data.data.officerName} placed on WAITING LIST`, 'warning');
        else showToast(`Nomination submitted (${s})`, 'success');
        fetchTrainings();
        fetchNominations(selectedTrainingId);
        setActiveTab('nominations');
      } else if (res.status === 409) {
        showToast(`Task 1 Duplicate: ${data.message}`, 'error');
      } else if (res.status === 400) {
        showToast(`Task 3 Ineligible: ${data.message}`, 'error');
      } else {
        showToast(data.message || `Error ${res.status}`, 'error');
      }
    } catch (err) { showToast(`Network error: ${err.message}`, 'error'); }
  };

  const fetchNominations = async (tId) => {
    if (!tId) return;
    try {
      const res  = await authFetch(`${API}/trainings/${tId}/nominations`);
      const data = await res.json();
      if (res.ok && data.data) setNominations(data.data);
    } catch { /* silent */ }
  };

  const fetchWaitingList = async (tId) => {
    if (!tId) return;
    try {
      const res  = await authFetch(`${API}/trainings/${tId}/waiting-list`);
      const data = await res.json();
      if (res.ok && data.data) setWaitingList(data.data);
    } catch { /* silent */ }
  };

  const handleCancelNomination = async (id) => {
    if (!window.confirm('Cancel this nomination? The first officer on the waiting list will be automatically promoted.')) return;
    try {
      const res  = await authFetch(`${API}/nominations/${id}/cancel`, { method: 'PUT' });
      const data = await res.json();
      if (res.ok) {
        showToast('Nomination cancelled. Waiting list auto-promoted!', 'success');
        fetchNominations(selectedTrainingId);
        fetchTrainings();
      } else {
        showToast(data.message || 'Failed to cancel', 'error');
      }
    } catch (err) { showToast(`Network error: ${err.message}`, 'error'); }
  };

  // ── Helpers ───────────────────────────────────────────────────
  const confirmedCount = nominations.filter(n => n.status === 'CONFIRMED').length;
  const waitingCount   = nominations.filter(n => n.status === 'WAITING_LIST').length;

  const tabs = [
    { id: 'trainings',       label: 'Training Programmes', icon: '📋' },
    { id: 'nominate',        label: 'Nominate Officer',    icon: '➕' },
    { id: 'nominations',     label: 'Nominations',         icon: '📊' },
    { id: 'waiting',         label: 'Waiting List',        icon: '⏳' },
    { id: 'create-training', label: editingTrainingId ? '✏️ Edit Training' : '⚙️ Create Training', icon: editingTrainingId ? '✏️' : '⚙️' },
  ];

  return (
    <div className="gtms-app">

      {/* ─── Header ──────────────────────────────────── */}
      <header className="app-header">
        <div className="header-brand">
          <div className="header-logo">🏛️</div>
          <div>
            <h1>Ministry of Finance, Planning & Economic Development</h1>
            <p>Government Training Management System — Treasury ITMD</p>
          </div>
        </div>

        <div className="header-right">
          {user ? (
            <>
              <div className="user-info">
                <div className="user-name">{user.fullName}</div>
                <div className="user-dept">{user.departmentName}</div>
              </div>
              <span className="role-tag">{user.role?.replace('ROLE_', '')}</span>
              <button className="btn-logout" onClick={logout}>Logout</button>
            </>
          ) : (
            <span style={{ fontSize: '0.82rem', color: '#a0aec0' }}>Not logged in</span>
          )}
        </div>
      </header>

      {/* ─── Toast ───────────────────────────────────── */}
      <Toast toast={toast} />

      <div className="main-content">

        {/* ─── Quick Login ─────────────────────────────── */}
        <div className="login-card">
          <div className="login-card-title">⚡ Quick Login — One-Click Test Access</div>
          <div className="preset-buttons">
            <button className="btn-preset coordinator" onClick={() => loginPreset('coordinator@treasury.gov.lk', 'admin123')}>
              👑 Coordinator (Admin)
            </button>
            <button className="btn-preset" onClick={() => loginPreset('depthead.fin@treasury.gov.lk', 'head123')}>
              💼 Finance Dept Head
            </button>
            <button className="btn-preset" onClick={() => loginPreset('depthead.adm@treasury.gov.lk', 'head123')}>
              🏛️ Admin Dept Head
            </button>
            <button className="btn-preset" onClick={() => loginPreset('perera@treasury.gov.lk', 'officer123')}>
              👤 Officer A. Perera (Grade I, 5 yrs)
            </button>
          </div>
        </div>

        {/* ─── Tab Navigation ──────────────────────────── */}
        <div className="tabs-bar">
          {tabs.map(t => (
            <button
              key={t.id}
              className={`tab-btn ${activeTab === t.id ? 'active' : ''}`}
              onClick={() => setActiveTab(t.id)}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* ════════════════════════════════════════════════
            TAB 1 — Training Programmes
        ════════════════════════════════════════════════ */}
        {activeTab === 'trainings' && (
          <div className="panel">
            <div className="panel-header">
              <div className="panel-title">
                <div className="title-icon">📋</div>
                Active Training Programmes & Dynamic Eligibility Rules
              </div>
              <button className="btn btn-refresh" onClick={fetchTrainings}>↻ Refresh</button>
            </div>
            <div className="panel-body">
              {trainings.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📋</div>
                  <p>No training programmes available. Login as Coordinator to create one.</p>
                </div>
              ) : (
                <div className="cards-grid">
                  {trainings.map(t => {
                    const count   = t.currentNominationCount || 0;
                    const max     = t.maxParticipants || 1;
                    const pct     = Math.min(100, Math.round((count / max) * 100));
                    const isFull  = count >= max;
                    const fillCls = isFull ? 'full' : pct >= 75 ? 'near' : '';
                    return (
                      <div key={t.id} className="training-card">
                        <div className="card-top">
                          <div className="card-title-text">{t.title}</div>
                          <span className={`badge ${isFull ? 'badge-full' : 'badge-available'}`}>
                            {isFull ? 'Full' : 'Open'}
                          </span>
                        </div>
                        <div className="card-meta">
                          <div className="meta-row">
                            <span className="meta-label">Date</span>
                            <span>{t.trainingDate || '—'}</span>
                          </div>
                          <div className="meta-row">
                            <span className="meta-label">Venue</span>
                            <span>{t.venueName} {t.venueCapacity ? `(cap. ${t.venueCapacity})` : ''}</span>
                          </div>
                          <div className="meta-row">
                            <span className="meta-label">Trainer</span>
                            <span>{t.trainerName} {t.trainerType ? `[${t.trainerType}]` : ''}</span>
                          </div>
                          {t.targetDepartments?.length > 0 && (
                            <div className="meta-row">
                              <span className="meta-label">Target Depts</span>
                              <span>{t.targetDepartments.join(', ')}</span>
                            </div>
                          )}
                          {t.minYearsOfService > 0 && (
                            <div className="meta-row">
                              <span className="meta-label">Min Service</span>
                              <span>{t.minYearsOfService} year(s)</span>
                            </div>
                          )}
                          {t.requiredGrade && (
                            <div className="meta-row">
                              <span className="meta-label">Req Grade</span>
                              <span>{t.requiredGrade}</span>
                            </div>
                          )}
                        </div>
                        <div className="capacity-section">
                          <div className="capacity-label">
                            <span>Confirmed: {count} / {max}</span>
                            <span>{pct}%</span>
                          </div>
                          <div className="capacity-track">
                            <div className={`capacity-fill ${fillCls}`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>

                        {user?.role === 'ROLE_COORDINATOR' && (
                          <div style={{ marginTop: 14, paddingTop: 10, borderTop: '1px solid var(--border)', textAlign: 'right' }}>
                            <button className="btn btn-refresh" onClick={() => handleEditClick(t)}>
                              ✏️ Edit Programme
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════
            TAB 2 — Nominate Officer
        ════════════════════════════════════════════════ */}
        {activeTab === 'nominate' && (
          <div className="panel">
            <div className="panel-header">
              <div className="panel-title">
                <div className="title-icon">➕</div>
                Submit Officer Nomination
              </div>
            </div>
            <div className="panel-body">
              <div className="form-section">
                <div className="info-box">
                  <p><strong>Task 1 — Duplicate Prevention:</strong> Submitting the same officer twice returns HTTP 409 Conflict.</p>
                  <p><strong>Task 2 — Capacity & Waiting List:</strong> Nominations beyond max capacity are assigned WAITING_LIST status.</p>
                  <p><strong>Task 3 — Eligibility Engine:</strong> Validates Department, Minimum Experience, Grade, and 12-Month Cooldown rules.</p>
                </div>

                <form onSubmit={handleNominate}>
                  <div className="form-group">
                    <label className="form-label">Training Programme</label>
                    <select
                      className="form-control"
                      value={selectedTrainingId}
                      onChange={e => setSelectedTrainingId(e.target.value)}
                      required
                    >
                      <option value="">— Select Training —</option>
                      {trainings.map(t => (
                        <option key={t.id} value={t.id}>
                          {t.title} (Max: {t.maxParticipants})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Officer to Nominate (Loaded Dynamically from Backend DB)</label>
                    <select
                      className="form-control"
                      value={nominateOfficerId}
                      onChange={e => setNominateOfficerId(e.target.value)}
                      required
                    >
                      {officers.length === 0 ? (
                        <option value="">Loading officers from database...</option>
                      ) : (
                        officers.map(o => (
                          <option key={o.id} value={o.id}>
                            {o.fullName} — NIC: {o.nic} ({o.departmentName} | {o.grade || 'No Grade'} | {o.yearsOfService || 0} yrs exp)
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  <button type="submit" className="btn btn-primary">Submit Nomination</button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════
            TAB 3 — Combined Nominations
        ════════════════════════════════════════════════ */}
        {activeTab === 'nominations' && (
          <div className="panel">
            <div className="panel-header">
              <div className="panel-title">
                <div className="title-icon">📊</div>
                Combined Department Nominations
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <select
                  className="form-control"
                  style={{ width: 220 }}
                  value={selectedTrainingId}
                  onChange={e => setSelectedTrainingId(e.target.value)}
                >
                  {trainings.map(t => (
                    <option key={t.id} value={t.id}>{t.title}</option>
                  ))}
                </select>
                <button className="btn btn-refresh" onClick={() => fetchNominations(selectedTrainingId)}>↻</button>
              </div>
            </div>
            <div className="panel-body">
              {nominations.length > 0 && (
                <div className="stats-bar" style={{ marginBottom: 20 }}>
                  <div className="stat-chip">
                    <span className="stat-value">{nominations.length}</span>
                    <span className="stat-label">Total</span>
                  </div>
                  <div className="stat-chip">
                    <span className="stat-value" style={{ color: 'var(--green)' }}>{confirmedCount}</span>
                    <span className="stat-label">Confirmed</span>
                  </div>
                  <div className="stat-chip">
                    <span className="stat-value" style={{ color: 'var(--amber)' }}>{waitingCount}</span>
                    <span className="stat-label">Waiting</span>
                  </div>
                </div>
              )}

              {nominations.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📊</div>
                  <p>No nominations found for this training. Select a training and submit nominations first.</p>
                </div>
              ) : (
                <div className="table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Officer</th>
                        <th>Email</th>
                        <th>Department</th>
                        <th>Submitted At</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {nominations.map((n, i) => (
                        <tr key={n.id}>
                          <td style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{i + 1}</td>
                          <td>
                            <div className="officer-name">{n.officerName}</div>
                            <div className="officer-nic">{n.officerNic}</div>
                          </td>
                          <td className="officer-email">{n.officerEmail}</td>
                          <td>{n.nominatingDepartmentName}</td>
                          <td style={{ color: 'var(--text-muted)', fontSize: '0.79rem' }}>
                            {new Date(n.nominatedAt).toLocaleString()}
                          </td>
                          <td>
                            <span className={`badge badge-${n.status?.toLowerCase()}`}>
                              {n.status?.replace('_', ' ')}
                            </span>
                          </td>
                          <td>
                            {n.status !== 'CANCELLED' ? (
                              <button className="btn btn-danger" onClick={() => handleCancelNomination(n.id)}>
                                Cancel
                              </button>
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════
            TAB 4 — Waiting List
        ════════════════════════════════════════════════ */}
        {activeTab === 'waiting' && (
          <div className="panel">
            <div className="panel-header">
              <div className="panel-title">
                <div className="title-icon">⏳</div>
                Waiting List — First Come, First Served (Task 2)
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <select
                  className="form-control"
                  style={{ width: 220 }}
                  value={selectedTrainingId}
                  onChange={e => setSelectedTrainingId(e.target.value)}
                >
                  {trainings.map(t => (
                    <option key={t.id} value={t.id}>{t.title}</option>
                  ))}
                </select>
                <button className="btn btn-refresh" onClick={() => fetchWaitingList(selectedTrainingId)}>↻</button>
              </div>
            </div>
            <div className="panel-body">
              <div className="info-box" style={{ marginBottom: 20 }}>
                When a confirmed participant cancels, the <strong>#1 officer on this queue is automatically promoted</strong> to CONFIRMED status.
              </div>

              {waitingList.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">⏳</div>
                  <p>No officers currently on the waiting list for this training.</p>
                </div>
              ) : (
                <div className="table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Priority</th>
                        <th>Officer</th>
                        <th>NIC</th>
                        <th>Department</th>
                        <th>Submitted At</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {waitingList.map((n, i) => (
                        <tr key={n.id}>
                          <td>
                            <span className={`queue-rank ${i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : ''}`}>
                              {i + 1}
                            </span>
                          </td>
                          <td>
                            <div className="officer-name">{n.officerName}</div>
                          </td>
                          <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{n.officerNic}</td>
                          <td>{n.nominatingDepartmentName}</td>
                          <td style={{ color: 'var(--text-muted)', fontSize: '0.79rem' }}>
                            {new Date(n.nominatedAt).toLocaleString()}
                          </td>
                          <td>
                            <span className="badge badge-waiting_list">Waiting List</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════
            TAB 5 — Create / Edit Training
        ════════════════════════════════════════════════ */}
        {activeTab === 'create-training' && (
          <div className="panel">
            <div className="panel-header">
              <div className="panel-title">
                <div className="title-icon">{editingTrainingId ? '✏️' : '⚙️'}</div>
                {editingTrainingId ? 'Edit Training Programme' : 'Create New Training Programme'}
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                {editingTrainingId && (
                  <button className="btn btn-refresh" onClick={handleCancelEdit}>
                    ✕ Cancel Edit
                  </button>
                )}
                <span className="badge badge-full" style={{ fontSize: '0.72rem' }}>Coordinator Only</span>
              </div>
            </div>
            <div className="panel-body">
              <div className="form-section">
                {!user || user.role !== 'ROLE_COORDINATOR' ? (
                  <div className="info-box">
                    ⚠️ You must be logged in as <strong>Coordinator</strong> to create or edit training programmes. Use Quick Login above.
                  </div>
                ) : null}

                <form onSubmit={handleCreateOrUpdateTraining}>
                  <div className="form-group">
                    <label className="form-label">Training Title</label>
                    <input
                      type="text"
                      className="form-control"
                      value={newTraining.title}
                      onChange={e => setNewTraining({ ...newTraining, title: e.target.value })}
                      placeholder="e.g. Executive Management Development Programme"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Description</label>
                    <textarea
                      className="form-control"
                      value={newTraining.description}
                      onChange={e => setNewTraining({ ...newTraining, description: e.target.value })}
                      placeholder="Programme objectives..."
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Training Date</label>
                    <input
                      type="date"
                      className="form-control"
                      value={newTraining.trainingDate}
                      onChange={e => setNewTraining({ ...newTraining, trainingDate: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Max Participants Capacity</label>
                    <input
                      type="number"
                      className="form-control"
                      value={newTraining.maxParticipants}
                      onChange={e => setNewTraining({ ...newTraining, maxParticipants: e.target.value })}
                      min="1"
                      required
                    />
                  </div>

                  {/* Task 3 Eligibility Configuration */}
                  <div className="info-box" style={{ background: '#f8fafc', border: '1px solid #cbd5e1', color: 'var(--navy)' }}>
                    <strong>🎯 Task 3 Dynamic Eligibility Rules Setup:</strong>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Minimum Years of Service Required (Task 3 Rule)</label>
                    <input
                      type="number"
                      className="form-control"
                      value={newTraining.minYearsOfService}
                      onChange={e => setNewTraining({ ...newTraining, minYearsOfService: e.target.value })}
                      min="0"
                      placeholder="e.g. 3"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Required Grade / Designation (Task 3 Rule)</label>
                    <select
                      className="form-control"
                      value={newTraining.requiredGrade}
                      onChange={e => setNewTraining({ ...newTraining, requiredGrade: e.target.value })}
                    >
                      <option value="">— Any Grade Allowed —</option>
                      <option value="Grade I">Grade I Only</option>
                      <option value="Grade II">Grade II Only</option>
                      <option value="Executive">Executive Only</option>
                    </select>
                  </div>

                  <button type="submit" className="btn btn-primary">
                    {editingTrainingId ? '💾 Save Changes' : '📅 Publish Training Programme'}
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
