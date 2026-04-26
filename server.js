const express = require('express');
const cors = require('cors');
const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5001;
const SKILLS_BASE_DIR = path.join(__dirname, 'skills');

if (!fs.existsSync(SKILLS_BASE_DIR)) {
  fs.mkdirSync(SKILLS_BASE_DIR, { recursive: true });
}

// Serve static files from the React app
app.use(express.static(path.join(__dirname, 'client/dist')));

// State: { [skillId]: { skillProcess, cloudflareProcess, logs, cloudflareUrl } }
const skillStates = {};

function getSkillState(skillId) {
  if (!skillStates[skillId]) {
    skillStates[skillId] = {
      skillProcess: null,
      cloudflareProcess: null,
      logs: [],
      cloudflareUrl: ''
    };
  }
  return skillStates[skillId];
}

function addLog(skillId, msg) {
  const state = getSkillState(skillId);
  console.log(`[${skillId}] ${msg}`);
  state.logs.push(`[${new Date().toLocaleTimeString()}] ${msg}`);
  if (state.logs.length > 500) state.logs.shift();
}

function killProcess(proc) {
  if (proc) {
    try {
      if (process.platform === 'win32') {
        exec(`taskkill /pid ${proc.pid} /T /F`);
      } else {
        process.kill(-proc.pid);
      }
    } catch (e) {
      console.error("Error killing process", e);
    }
  }
}

app.get('/api/skills', (req, res) => {
  try {
    const dirs = fs.readdirSync(SKILLS_BASE_DIR).filter(file => {
      return fs.statSync(path.join(SKILLS_BASE_DIR, file)).isDirectory();
    });
    res.json({ skills: dirs });
  } catch (e) {
    res.status(500).json({ error: 'Failed to list skills' });
  }
});

app.post('/api/clone', (req, res) => {
  const { repoUrl, skillId } = req.body;
  if (!repoUrl || !skillId) return res.status(400).json({ error: 'repoUrl and skillId are required' });

  const skillDir = path.join(SKILLS_BASE_DIR, skillId);
  addLog(skillId, `Starting clone for ${repoUrl}...`);

  if (fs.existsSync(skillDir)) {
    addLog(skillId, 'Existing skill directory found. Removing...');
    try {
      fs.rmSync(skillDir, { recursive: true, force: true });
    } catch (e) {
      addLog(skillId, `Error removing directory: ${e.message}`);
      return res.status(500).json({ error: 'Failed to clean existing directory' });
    }
  }

  exec(`git clone ${repoUrl} "${skillId}"`, { cwd: SKILLS_BASE_DIR }, (error, stdout, stderr) => {
    if (error) {
      addLog(skillId, `Git clone error: ${error.message}`);
      return res.status(500).json({ error: 'Git clone failed', details: error.message });
    }
    addLog(skillId, 'Clone successful.');
    res.json({ message: 'Cloned successfully' });
  });
});

app.get('/api/env/:skillId', (req, res) => {
  const { skillId } = req.params;
  const envPath = path.join(SKILLS_BASE_DIR, skillId, '.env');
  if (fs.existsSync(envPath)) {
    res.json({ content: fs.readFileSync(envPath, 'utf8') });
  } else {
    res.json({ content: '' });
  }
});

app.post('/api/env/:skillId', (req, res) => {
  const { skillId } = req.params;
  const { content } = req.body;
  const skillDir = path.join(SKILLS_BASE_DIR, skillId);

  if (!fs.existsSync(skillDir)) {
    return res.status(400).json({ error: 'Skill directory not found. Please clone first.' });
  }
  const envPath = path.join(skillDir, '.env');
  fs.writeFileSync(envPath, content || '');
  addLog(skillId, '.env file updated.');
  res.json({ message: '.env updated successfully' });
});

app.post('/api/pull/:skillId', (req, res) => {
  const { skillId } = req.params;
  const skillDir = path.join(SKILLS_BASE_DIR, skillId);

  if (!fs.existsSync(skillDir)) {
    return res.status(400).json({ error: 'Skill directory not found.' });
  }

  addLog(skillId, 'Pulling latest changes from Git...');
  exec('git pull', { cwd: skillDir }, (err, stdout, stderr) => {
    if (err) {
      addLog(skillId, `Git pull failed: ${err.message}`);
      return res.status(500).json({ error: 'Git pull failed', details: err.message });
    }
    addLog(skillId, 'Git pull completed successfully.');
    addLog(skillId, stdout);
    res.json({ message: 'Pulled successfully', output: stdout });
  });
});

app.post('/api/publish/:skillId', (req, res) => {
  const { skillId } = req.params;
  const skillDir = path.join(SKILLS_BASE_DIR, skillId);
  const state = getSkillState(skillId);

  if (!fs.existsSync(skillDir)) {
    return res.status(400).json({ error: 'Skill directory not found.' });
  }
  if (state.skillProcess || state.cloudflareProcess) {
    return res.status(400).json({ error: 'Server is already running for this skill.' });
  }

  state.logs = [];
  state.cloudflareUrl = '';
  addLog(skillId, 'Starting publish process...');

  addLog(skillId, 'Running npm install...');
  exec('npm install', { cwd: skillDir }, (err, stdout, stderr) => {
    if (err) {
      addLog(skillId, `npm install failed: ${err.message}`);
      return res.status(500).json({ error: 'npm install failed' });
    }
    addLog(skillId, 'npm install completed successfully.');

    // Try to find port in .env
    let port = 3000;
    const envPath = path.join(skillDir, '.env');
    if (fs.existsSync(envPath)) {
      const env = fs.readFileSync(envPath, 'utf8');
      const match = env.match(/PORT=(\d+)/);
      if (match) port = parseInt(match[1]);
    }

    addLog(skillId, `Starting skill server on port ${port}...`);
    const spawnOptions = { cwd: skillDir, shell: true };
    if (process.platform !== 'win32') spawnOptions.detached = true;

    state.skillProcess = spawn('npm', ['start'], spawnOptions);

    state.skillProcess.stdout.on('data', data => addLog(skillId, `[SKILL] ${data.toString().trim()}`));
    state.skillProcess.stderr.on('data', data => addLog(skillId, `[SKILL] ${data.toString().trim()}`));
    state.skillProcess.on('close', code => {
      addLog(skillId, `Skill server exited with code ${code}`);
      state.skillProcess = null;
    });

    // Start Cloudflare tunnel
    addLog(skillId, `Starting cloudflared tunnel for port ${port}...`);
    state.cloudflareProcess = spawn('npx', ['cloudflared', 'tunnel', '--url', `http://localhost:${port}`], {
      cwd: __dirname,
      shell: true
    });

    state.cloudflareProcess.stdout.on('data', data => {
      const str = data.toString();
      addLog(skillId, `[CLOUDFLARE] ${str.trim()}`);
    });

    state.cloudflareProcess.stderr.on('data', data => {
      const str = data.toString();
      addLog(skillId, `[CLOUDFLARE] ${str.trim()}`);
      const match = str.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
      if (match && !state.cloudflareUrl) {
        state.cloudflareUrl = match[0];
        addLog(skillId, `*** TUNNEL ESTABLISHED: ${state.cloudflareUrl} ***`);
      }
    });

    state.cloudflareProcess.on('close', code => {
      addLog(skillId, `Cloudflare tunnel exited with code ${code}`);
      state.cloudflareProcess = null;
    });

    res.json({ message: 'Publish process started successfully' });
  });
});

app.delete('/api/skills/:skillId', (req, res) => {
  const { skillId } = req.params;
  const skillDir = path.join(SKILLS_BASE_DIR, skillId);
  const state = skillStates[skillId];

  if (state) {
    addLog(skillId, 'Stopping services for deletion...');
    killProcess(state.skillProcess);
    killProcess(state.cloudflareProcess);
    delete skillStates[skillId];
  }

  if (fs.existsSync(skillDir)) {
    try {
      fs.rmSync(skillDir, { recursive: true, force: true });
      res.json({ message: 'Skill deleted successfully' });
    } catch (e) {
      res.status(500).json({ error: 'Failed to delete skill directory' });
    }
  } else {
    res.status(404).json({ error: 'Skill directory not found' });
  }
});

app.post('/api/stop/:skillId', (req, res) => {
  const { skillId } = req.params;
  const state = getSkillState(skillId);
  addLog(skillId, 'Stopping services...');
  killProcess(state.skillProcess);
  killProcess(state.cloudflareProcess);
  state.skillProcess = null;
  state.cloudflareProcess = null;
  state.cloudflareUrl = '';
  res.json({ message: 'Stopped successfully' });
});

app.get('/api/models/:skillId', (req, res) => {
  const { skillId } = req.params;
  const modelsDir = path.join(SKILLS_BASE_DIR, skillId, 'models');
  if (!fs.existsSync(modelsDir)) return res.json({ models: [] });

  try {
    const files = fs.readdirSync(modelsDir).filter(file => file.endsWith('.json'));
    res.json({ models: files });
  } catch (e) {
    res.status(500).json({ error: 'Failed to list models' });
  }
});

app.get('/api/models/:skillId/:modelName', (req, res) => {
  const { skillId, modelName } = req.params;
  const modelPath = path.join(SKILLS_BASE_DIR, skillId, 'models', modelName);
  if (fs.existsSync(modelPath)) {
    res.json({ content: fs.readFileSync(modelPath, 'utf8') });
  } else {
    res.status(404).json({ error: 'Model not found' });
  }
});

app.post('/api/models/:skillId/:modelName', (req, res) => {
  const { skillId, modelName } = req.params;
  const { content } = req.body;
  const modelsDir = path.join(SKILLS_BASE_DIR, skillId, 'models');

  if (!fs.existsSync(modelsDir)) {
    fs.mkdirSync(modelsDir, { recursive: true });
  }

  const modelPath = path.join(modelsDir, modelName);
  try {
    fs.writeFileSync(modelPath, content);
    addLog(skillId, `Model ${modelName} updated.`);
    res.json({ message: 'Model updated successfully' });
  } catch (e) {
    res.status(500).json({ error: 'Failed to save model' });
  }
});

app.post('/api/restart/:skillId', (req, res) => {
  const { skillId } = req.params;
  const state = getSkillState(skillId);
  const skillDir = path.join(SKILLS_BASE_DIR, skillId);

  if (!fs.existsSync(skillDir)) {
    return res.status(400).json({ error: 'Skill directory not found.' });
  }

  addLog(skillId, 'Restarting skill server...');
  killProcess(state.skillProcess);
  state.skillProcess = null;

  // Try to find port in .env
  let port = 3000;
  const envPath = path.join(skillDir, '.env');
  if (fs.existsSync(envPath)) {
    const env = fs.readFileSync(envPath, 'utf8');
    const match = env.match(/PORT=(\d+)/);
    if (match) port = parseInt(match[1]);
  }

  const spawnOptions = { cwd: skillDir, shell: true };
  if (process.platform !== 'win32') spawnOptions.detached = true;

  state.skillProcess = spawn('npm', ['start'], spawnOptions);

  state.skillProcess.stdout.on('data', data => addLog(skillId, `[SKILL] ${data.toString().trim()}`));
  state.skillProcess.stderr.on('data', data => addLog(skillId, `[SKILL] ${data.toString().trim()}`));
  state.skillProcess.on('close', code => {
    addLog(skillId, `Skill server exited with code ${code}`);
    state.skillProcess = null;
  });

  res.json({ message: 'Restarted successfully' });
});

app.get('/api/status/:skillId', (req, res) => {
  const { skillId } = req.params;
  const state = getSkillState(skillId);
  res.json({
    isRunning: !!(state.skillProcess || state.cloudflareProcess),
    cloudflareUrl: state.cloudflareUrl,
    logs: state.logs
  });
});

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'client/dist/index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
