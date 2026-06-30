import fs from 'fs';
import path from 'path';
import os from 'os';

const CONFIG_DIRS = {
  win32: path.join(process.env.LOCALAPPDATA || os.homedir(), 'openagent'),
  darwin: path.join(os.homedir(), 'Library', 'Application Support', 'openagent'),
  linux: path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'openagent'),
};
const configDir = CONFIG_DIRS[process.platform] || path.join(os.homedir(), '.openagent');

const dirs = [
  configDir,
  path.join(configDir, 'audit_logs'),
  path.join(configDir, 'skills', 'builtin'),
  path.join(configDir, 'skills', 'installed'),
  path.join(configDir, 'skills', 'custom'),
  path.join(configDir, 'skills', 'user-generated'),
  path.join(configDir, 'sessions'),
  path.join(configDir, 'export'),
  path.join(configDir, 'trash'),
  path.join(configDir, 'backups'),
];

dirs.forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const configPath = path.join(configDir, 'config.yaml');
if (!fs.existsSync(configPath)) {
  const defaultConfig = `# OpenAgent Configuration
app:
  theme: hermes
  language: en
  telemetry: false
  auto_update: false

model:
  backend: ollama
  base_url: http://localhost:11434
  primary: mistral:latest
  temperature: 0.7
  max_tokens: 2048
  fallback:
    - provider: ollama
      model: neural-chat:latest
    - provider: ollama
      model: tinyllama:latest

network:
  allow_outbound: false
  allow_web_search: false
  allow_model_api: false
  air_gap: false

reasoning:
  show_thinking: true
  thinking_time: auto

memory:
  enabled: true
  max_sessions: 100
  context_strategy: adaptive
  encrypt: false

security:
  level: strict
  sandbox: true
  audit_logging: true
  require_approval: true
  allowed_dirs:
    - "."
  rules:
    - action: file_read
      resource: "**"
      effect: allow
    - action: git_status
      resource: "**"
      effect: allow
    - action: file_write
      resource: "**"
      effect: ask
    - action: exec_command
      resource: "**"
      effect: ask
    - action: git_commit
      resource: "**"
      effect: ask
    - action: git_push
      resource: "**"
      effect: ask
    - action: file_delete
      resource: "**"
      effect: ask

plugins:
  enabled:
    - file_system
    - terminal
    - git
    - code_analyzer
    - memory

ui:
  colors:
    primary: "#00D9FF"
    accent: "#7C3AED"
    success: "#10B981"
    error: "#EF4444"
  streaming: true
  show_token_count: true
  syntax_highlighting: true
`;
  fs.writeFileSync(configPath, defaultConfig);
}

console.log('\nOpenAgent installed successfully!\n');
console.log('Quick start:');
console.log('  1. Install Ollama: https://ollama.ai');
console.log('  2. Pull a model:   ollama pull mistral');
console.log('  3. Start chatting: openagent chat\n');
console.log('Commands:');
console.log('  openagent chat        # Interactive mode');
console.log('  openagent --help      # All commands');
console.log('  openagent /doctor     # Health check');
console.log('  openagent /config     # Settings\n');
console.log('Config: ' + configPath);
console.log('Docs:   https://github.com/openagent-dev/openagent\n');
