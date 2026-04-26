import React, { useState, useEffect, useRef } from 'react';
import { GitBranch, Save, Play, Square, Activity, Terminal, Globe, Server, Plus, ChevronRight, Hash, Trash2, FileText, Copy, ClipboardCopy, RefreshCcw } from 'lucide-react';
import './index.css';

function App() {
  const [skills, setSkills] = useState([]);
  const [currentSkillId, setCurrentSkillId] = useState(null);
  const [repoUrl, setRepoUrl] = useState('');
  const [newSkillName, setNewSkillName] = useState('');
  const [envContent, setEnvContent] = useState('');
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState(null);
  const [modelContent, setModelContent] = useState('');
  const [status, setStatus] = useState({ isRunning: false, cloudflareUrl: '', logs: [] });
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg, isError = false) => {
    setToast({ msg, isError });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchSkills = async () => {
    try {
      const res = await fetch('/api/skills');
      const data = await res.json();
      setSkills(data.skills || []);
    } catch (e) {
      console.error("Failed to fetch skills");
    }
  };

  const fetchModels = async () => {
    if (!currentSkillId) return;
    try {
      const res = await fetch(`/api/models/${currentSkillId}`);
      const data = await res.json();
      setModels(data.models || []);
      if (data.models.length > 0 && !selectedModel) {
        setSelectedModel(data.models[0]);
      }
    } catch (e) {
      console.error("Failed to fetch models");
    }
  };

  const fetchModelContent = async () => {
    if (!currentSkillId || !selectedModel) return;
    try {
      const res = await fetch(`/api/models/${currentSkillId}/${selectedModel}`);
      const data = await res.json();
      setModelContent(data.content || '');
    } catch (e) {
      console.error("Failed to fetch model content");
    }
  };

  const fetchStatus = async () => {
    if (!currentSkillId) return;
    try {
      const res = await fetch(`/api/status/${currentSkillId}`);
      const data = await res.json();
      setStatus(data);
    } catch (e) {
      console.error("Failed to fetch status");
    }
  };

  const fetchEnv = async () => {
    if (!currentSkillId) return;
    try {
      const res = await fetch(`/api/env/${currentSkillId}`);
      const data = await res.json();
      setEnvContent(data.content || '');
    } catch (e) {
      console.error("Failed to fetch env");
    }
  };

  useEffect(() => {
    fetchSkills();
  }, []);

  useEffect(() => {
    if (currentSkillId) {
      fetchStatus();
      fetchEnv();
      fetchModels();
    } else {
      setStatus({ isRunning: false, cloudflareUrl: '', logs: [] });
      setEnvContent('');
      setModels([]);
      setSelectedModel(null);
      setModelContent('');
    }
  }, [currentSkillId]);

  useEffect(() => {
    if (currentSkillId && selectedModel) {
      fetchModelContent();
    }
  }, [currentSkillId, selectedModel]);

  useEffect(() => {
    const interval = setInterval(fetchStatus, 2000);
    return () => clearInterval(interval);
  }, [currentSkillId]);


  const handleClone = async () => {
    if (!repoUrl || !newSkillName) return showToast('Repo URL and Skill Name are required', true);
    setLoading(true);
    try {
      const res = await fetch('/api/clone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoUrl, skillId: newSkillName })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast('Repository cloned successfully!');
      setRepoUrl('');
      setNewSkillName('');
      await fetchSkills();
      setCurrentSkillId(newSkillName);
    } catch (e) {
      showToast(e.message, true);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEnv = async () => {
    if (!currentSkillId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/env/${currentSkillId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: envContent })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast('.env saved successfully!');
    } catch (e) {
      showToast(e.message, true);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveModel = async () => {
    if (!currentSkillId || !selectedModel) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/models/${currentSkillId}/${selectedModel}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: modelContent })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast('Model saved successfully!');
    } catch (e) {
      showToast(e.message, true);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(modelContent);
    showToast('JSON copied to clipboard!');
  };

  const handleCopyModel = async () => {
    if (!currentSkillId || !selectedModel) return;
    const newName = window.prompt('Enter new model name (e.g. en-US.json):', selectedModel);
    if (!newName || newName === selectedModel) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/models/${currentSkillId}/${newName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: modelContent })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast('Model created successfully!');
      await fetchModels();
      setSelectedModel(newName);
    } catch (e) {
      showToast(e.message, true);
    } finally {
      setLoading(false);
    }
  };

  const handlePull = async () => {
    if (!currentSkillId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/pull/${currentSkillId}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast('Git pull successful');
      fetchStatus();
    } catch (e) {
      showToast(e.message, true);
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async () => {
    if (!currentSkillId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/publish/${currentSkillId}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast('Publishing started...');
      fetchStatus();
    } catch (e) {
      showToast(e.message, true);
    } finally {
      setLoading(false);
    }
  };

  const handleRestart = async () => {
    if (!currentSkillId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/restart/${currentSkillId}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast('Restarting server...');
      fetchStatus();
    } catch (e) {
      showToast(e.message, true);
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    if (!currentSkillId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/stop/${currentSkillId}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast('Stopped services');
      fetchStatus();
    } catch (e) {
      showToast(e.message, true);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSkill = async (e, skillId) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete "${skillId}" from disk?`)) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/skills/${skillId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast('Skill deleted successfully');
      if (currentSkillId === skillId) {
        setCurrentSkillId(null);
      }
      await fetchSkills();
    } catch (e) {
      showToast(e.message, true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <Server size={20} color="var(--accent-color)" />
          <span>My Skills</span>
        </div>
        <div className="sidebar-action">
          <button className="btn-icon" onClick={() => setCurrentSkillId(null)}>
            <Plus size={20} />
            <span>New Skill</span>
          </button>
        </div>
        <div className="skill-list">
          {skills.map(skill => (
            <div
              key={skill}
              className={`skill-item ${currentSkillId === skill ? 'active' : ''}`}
              onClick={() => setCurrentSkillId(skill)}
            >
              <Hash size={16} />
              <span>{skill}</span>
              <div className="skill-actions">
                <button
                  className="btn-ghost"
                  onClick={(e) => handleDeleteSkill(e, skill)}
                  title="Delete from disk"
                >
                  <Trash2 size={14} />
                </button>
                {currentSkillId === skill && <ChevronRight size={14} className="active-arrow" />}
              </div>
            </div>
          ))}
          {skills.length === 0 && (
            <div style={{ padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.8rem', textAlign: 'center' }}>
              No skills yet
            </div>
          )}
        </div>
        <div className="sidebar-footer">
          <p>© {new Date().getFullYear()} <a href="https://impedro.com" target="_blank" rel="noopener noreferrer">Pedro Fernandes</a></p>
        </div>
      </aside>

      <main className="main-content">
        <header className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <p style={{ margin: 0 }}>{currentSkillId ? `Managing: ${currentSkillId}` : 'Clone a new skill to get started'}</p>
            {currentSkillId && (
              <div className={`status-badge status-${status.isRunning ? 'running' : 'stopped'}`} style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem' }}>
                <div className="status-indicator"></div>
                {status.isRunning ? 'Running' : 'Stopped'}
              </div>
            )}
          </div>
          {currentSkillId && (
            <button className="btn btn-secondary" onClick={handlePull} disabled={loading} style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}>
              <GitBranch size={16} /> Pull from Git
            </button>
          )}
        </header>

        {!currentSkillId ? (
          <div className="clone-container">
            <div className="glass-panel">
              <div className="panel-header">
                <Plus size={24} color="var(--accent-color)" />
                Setup New Skill
              </div>
              <div className="input-group">
                <label>Skill Name (Directory ID)</label>
                <input
                  type="text"
                  placeholder="my-cool-skill"
                  value={newSkillName}
                  onChange={e => setNewSkillName(e.target.value)}
                />
              </div>
              <div className="input-group">
                <label>Git Repository URL</label>
                <input
                  type="text"
                  placeholder="https://github.com/user/alexa-skill.git"
                  value={repoUrl}
                  onChange={e => setRepoUrl(e.target.value)}
                />
              </div>
              <button className="btn btn-primary" onClick={handleClone} disabled={loading}>
                <GitBranch size={18} /> Clone & Install
              </button>
            </div>
          </div>
        ) : (
          <div className="grid-layout">
            {/* Environment Config Panel */}
            <div className="glass-panel">
              <div className="panel-header">
                <Save size={24} color="var(--accent-color)" />
                Environment (.env)
              </div>
              <div className="input-group">
                <textarea
                  placeholder="PORT=3000&#10;ALEXA_SKILL_ID=amzn1.ask.skill.xxx..."
                  value={envContent}
                  onChange={e => setEnvContent(e.target.value)}
                />
              </div>
              <button className="btn btn-primary" onClick={handleSaveEnv} disabled={loading}>
                <Save size={18} /> Save Config
              </button>
            </div>

            {/* Models Panel */}
            <div className="glass-panel">
              <div className="panel-header" style={{ justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <FileText size={24} color="var(--accent-color)" />
                  Interaction Models
                </div>
                <div className="model-selector">
                  {models.map(model => (
                    <button
                      key={model}
                      className={`model-tab ${selectedModel === model ? 'active' : ''}`}
                      onClick={() => setSelectedModel(model)}
                    >
                      {model}
                    </button>
                  ))}
                </div>
              </div>
              <div className="input-group">
                <textarea
                  placeholder='{"interactionModel": {...}}'
                  style={{ height: '300px', fontFamily: 'monospace' }}
                  value={modelContent}
                  onChange={e => setModelContent(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button className="btn btn-primary" onClick={handleSaveModel} disabled={loading} style={{ flex: 1 }}>
                  <Save size={18} /> Save Model
                </button>
                <button className="btn btn-secondary" onClick={handleCopyToClipboard} disabled={loading}>
                  <ClipboardCopy size={18} /> Copy to Clipboard
                </button>
                <button className="btn btn-secondary" onClick={handleCopyModel} disabled={loading}>
                  <Copy size={18} /> Copy as New Locale
                </button>
              </div>
            </div>

            {/* Publishing & Logs Panel */}
            <div className="glass-panel" style={{ height: '100%' }}>
              <div className="panel-header" style={{ justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <Activity size={24} color="var(--accent-color)" />
                  Status
                </div>
                <div className={`status-badge status-${status.isRunning ? 'running' : 'stopped'}`}>
                  <div className="status-indicator"></div>
                  {status.isRunning ? 'Running' : 'Stopped'}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                {!status.isRunning ? (
                  <button className="btn btn-success" style={{ flex: 1 }} onClick={handlePublish} disabled={loading}>
                    <Play size={18} /> Publish
                  </button>
                ) : (
                  <>
                    <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleRestart} disabled={loading}>
                      <RefreshCcw size={18} /> Restart
                    </button>
                    <button className="btn btn-danger" style={{ flex: 1 }} onClick={handleStop} disabled={loading}>
                      <Square size={18} /> Stop
                    </button>
                  </>
                )}
              </div>

              {status.cloudflareUrl && (
                <a href={status.cloudflareUrl} target="_blank" rel="noreferrer" className="cloudflare-link">
                  <Globe size={18} style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} />
                  {status.cloudflareUrl}
                </a>
              )}

              <div className="panel-header" style={{ marginTop: '1rem', paddingBottom: '0.5rem', fontSize: '1rem' }}>
                <Terminal size={18} color="var(--text-secondary)" />
                Logs
              </div>
              <div className="logs-container">
                {status.logs.length === 0 ? (
                  <div style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>No logs...</div>
                ) : (
                  status.logs.map((log, i) => (
                    <div key={i} className="log-line">{log}</div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {toast && (
        <div className={`toast ${toast.isError ? 'toast-error' : ''}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

export default App;

