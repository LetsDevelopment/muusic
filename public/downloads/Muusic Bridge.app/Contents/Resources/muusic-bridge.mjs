#!/usr/bin/env node
/* global fetch, setInterval, clearInterval, Buffer, console, process */

import { createServer } from 'http';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { homedir } from 'os';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { mkdir, readFile, writeFile, rm } from 'fs/promises';

const execFileAsync = promisify(execFile);
const PORT = 43821;
const HOST = '127.0.0.1';
const APP_VERSION = '0.3.0';
const CONFIG_PATH = join(homedir(), 'Library', 'Application Support', 'Muusic Bridge', 'config.json');
const LAUNCH_AGENT_ID = 'live.muusic.bridge';
const LAUNCH_AGENT_PATH = join(homedir(), 'Library', 'LaunchAgents', `${LAUNCH_AGENT_ID}.plist`);
const LOG_DIR = join(homedir(), 'Library', 'Logs', 'Muusic Bridge');
const HEARTBEAT_INTERVAL_MS = 60_000;
const SCRIPT_PATH = fileURLToPath(import.meta.url);

let syncTimer = null;
let heartbeatTimer = null;
let lastSyncAt = null;
let lastHeartbeatAt = null;
let lastNowPlaying = null;
let cachedConfig = null;
let lastError = null;

async function ensureConfigDir() {
  await mkdir(dirname(CONFIG_PATH), { recursive: true });
}

async function ensureLaunchAgentDir() {
  await mkdir(dirname(LAUNCH_AGENT_PATH), { recursive: true });
}

async function ensureLogDir() {
  await mkdir(LOG_DIR, { recursive: true });
}

async function loadConfig() {
  if (cachedConfig) return cachedConfig;
  try {
    const raw = await readFile(CONFIG_PATH, 'utf8');
    cachedConfig = JSON.parse(raw);
    return cachedConfig;
  } catch {
    cachedConfig = {};
    return cachedConfig;
  }
}

async function saveConfig(nextConfig) {
  cachedConfig = nextConfig;
  await ensureConfigDir();
  await writeFile(CONFIG_PATH, JSON.stringify(nextConfig, null, 2), 'utf8');
}

async function isLaunchAgentInstalled() {
  try {
    await readFile(LAUNCH_AGENT_PATH, 'utf8');
    return true;
  } catch {
    return false;
  }
}

function buildLaunchAgentPlist() {
  const escapedExecPath = String(process.execPath).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const escapedScriptPath = String(SCRIPT_PATH).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const escapedOut = join(LOG_DIR, 'bridge.log').replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const escapedErr = join(LOG_DIR, 'bridge-error.log').replace(/&/g, '&amp;').replace(/</g, '&lt;');

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LAUNCH_AGENT_ID}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${escapedExecPath}</string>
    <string>${escapedScriptPath}</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>WorkingDirectory</key>
  <string>${dirname(escapedScriptPath)}</string>
  <key>StandardOutPath</key>
  <string>${escapedOut}</string>
  <key>StandardErrorPath</key>
  <string>${escapedErr}</string>
</dict>
</plist>
`;
}

async function installLaunchAgent() {
  await ensureLaunchAgentDir();
  await ensureLogDir();
  await writeFile(LAUNCH_AGENT_PATH, buildLaunchAgentPlist(), 'utf8');
  return LAUNCH_AGENT_PATH;
}

async function removeLaunchAgent() {
  try {
    await execFileAsync('launchctl', ['bootout', `gui/${process.getuid()}`, LAUNCH_AGENT_PATH], { timeout: 3000 });
  } catch {
    // Ignore unload failures during cleanup.
  }
  await rm(LAUNCH_AGENT_PATH, { force: true });
}

async function readSpotifyDesktop() {
  const { stdout } = await execFileAsync(
    'osascript',
    [
      '-e',
      `tell application "Spotify"
        if player state is playing then
          set t to name of current track
          set ar to artist of current track
          set al to album of current track
          set u to spotify url of current track
          return "playing|||" & t & "|||" & ar & "|||" & al & "|||" & u
        else if player state is paused then
          set t to name of current track
          set ar to artist of current track
          set al to album of current track
          set u to spotify url of current track
          return "paused|||" & t & "|||" & ar & "|||" & al & "|||" & u
        else
          return "stopped"
        end if
      end tell`
    ],
    { timeout: 3000 }
  );

  const result = String(stdout || '').trim();
  if (!result || result === 'stopped') return null;
  const [state, trackName, artistName, albumName, externalUrl] = result.split('|||');
  return {
    trackName: String(trackName || '').trim(),
    artistName: String(artistName || '').trim(),
    albumName: String(albumName || '').trim(),
    externalUrl: String(externalUrl || '').trim() || null,
    isPlaying: state === 'playing',
    bridgeMode: 'desktop'
  };
}

async function pushNowPlaying() {
  const config = await loadConfig();
  if (!config.apiBaseUrl || !config.deviceToken) {
    throw new Error('Muusic Bridge não está pareado.');
  }

  const track = await readSpotifyDesktop().catch(() => null);
  const response = await fetch(`${String(config.apiBaseUrl).replace(/\/+$/, '')}/api/bridge/device-push`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.deviceToken}`
    },
    body: JSON.stringify(track || {})
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || 'Falha ao enviar now playing para o Muusic.');
  }

  lastSyncAt = new Date().toISOString();
  lastNowPlaying = payload.nowPlaying || null;
  lastError = null;
  return payload.nowPlaying || null;
}

async function sendHeartbeat() {
  const config = await loadConfig();
  if (!config.apiBaseUrl || !config.deviceToken) return null;

  const response = await fetch(`${String(config.apiBaseUrl).replace(/\/+$/, '')}/api/bridge/device/heartbeat`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.deviceToken}`
    }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || 'Falha ao atualizar heartbeat do Muusic Bridge.');
  }
  lastHeartbeatAt = new Date().toISOString();
  lastError = null;
  return payload;
}

async function startLoop() {
  if (!syncTimer) {
    syncTimer = setInterval(() => {
      pushNowPlaying().catch((error) => {
        lastError = error?.message || 'Falha ao sincronizar o Spotify desktop.';
      });
    }, 5000);
  }

  if (!heartbeatTimer) {
    heartbeatTimer = setInterval(() => {
      sendHeartbeat().catch((error) => {
        lastError = error?.message || 'Falha ao atualizar heartbeat.';
      });
    }, HEARTBEAT_INTERVAL_MS);
  }

  await Promise.allSettled([sendHeartbeat(), pushNowPlaying()]);
}

function stopLoop() {
  if (syncTimer) clearInterval(syncTimer);
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  syncTimer = null;
  heartbeatTimer = null;
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(payload));
}

function collectJson(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch {
        resolve({});
      }
    });
  });
}

const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    sendJson(res, 204, {});
    return;
  }

  if (req.method === 'GET' && req.url === '/status') {
    const config = await loadConfig();
    sendJson(res, 200, {
      ok: true,
      running: true,
      paired: Boolean(config.deviceToken),
      deviceId: config.deviceId || null,
      deviceName: config.deviceName || 'Muusic Bridge Mac',
      launchAtLoginEnabled: await isLaunchAgentInstalled(),
      appVersion: APP_VERSION,
      configPath: CONFIG_PATH,
      scriptPath: SCRIPT_PATH,
      lastSyncAt,
      lastHeartbeatAt,
      lastError,
      hasNowPlaying: Boolean(lastNowPlaying?.trackName)
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/pair') {
    const body = await collectJson(req);
    if (!body.apiBaseUrl || !body.deviceToken) {
      sendJson(res, 400, { error: 'apiBaseUrl e deviceToken são obrigatórios.' });
      return;
    }
    await saveConfig({
      appVersion: APP_VERSION,
      apiBaseUrl: String(body.apiBaseUrl || '').trim(),
      deviceToken: String(body.deviceToken || '').trim(),
      deviceId: String(body.deviceId || '').trim(),
      deviceName: String(body.deviceName || 'Muusic Bridge Mac').trim()
    });
    await installLaunchAgent();
    await startLoop();
    sendJson(res, 200, { ok: true, paired: true });
    return;
  }

  if (req.method === 'POST' && req.url === '/sync-once') {
    try {
      const nowPlaying = await pushNowPlaying();
      sendJson(res, 200, { ok: true, nowPlaying });
    } catch (error) {
      sendJson(res, 409, { error: error.message || 'Falha ao sincronizar o app Spotify.' });
    }
    return;
  }

  if (req.method === 'POST' && req.url === '/unpair') {
    const config = await loadConfig();
    await saveConfig({
      appVersion: APP_VERSION,
      deviceName: config.deviceName || 'Muusic Bridge Mac'
    });
    stopLoop();
    lastNowPlaying = null;
    lastError = null;
    sendJson(res, 200, { ok: true, paired: false });
    return;
  }

  if (req.method === 'POST' && req.url === '/stop-sync') {
    stopLoop();
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === 'POST' && req.url === '/install-launch-agent') {
    try {
      await installLaunchAgent();
      sendJson(res, 200, { ok: true, launchAtLoginEnabled: true });
    } catch (error) {
      sendJson(res, 500, { error: error?.message || 'Falha ao instalar inicialização automática.' });
    }
    return;
  }

  if (req.method === 'POST' && req.url === '/remove-launch-agent') {
    try {
      await removeLaunchAgent();
      sendJson(res, 200, { ok: true, launchAtLoginEnabled: false });
    } catch (error) {
      sendJson(res, 500, { error: error?.message || 'Falha ao remover inicialização automática.' });
    }
    return;
  }

  if (req.method === 'POST' && req.url === '/restart-sync') {
    try {
      stopLoop();
      await startLoop();
      sendJson(res, 200, { ok: true, restarted: true });
    } catch (error) {
      sendJson(res, 500, { error: error?.message || 'Falha ao reiniciar sincronização.' });
    }
    return;
  }

  if (req.method === 'POST' && req.url === '/open-muusic') {
    try {
      const config = await loadConfig();
      const targetUrl = String(config.apiBaseUrl || 'https://muusic.live').trim();
      await execFileAsync('open', [targetUrl], { timeout: 3000 });
      sendJson(res, 200, { ok: true });
    } catch (error) {
      sendJson(res, 500, { error: error?.message || 'Falha ao abrir o Muusic.' });
    }
    return;
  }

  sendJson(res, 404, { error: 'Not found' });
});

server.listen(PORT, HOST, async () => {
  const config = await loadConfig();
  await installLaunchAgent().catch(() => {});
  if (config.deviceToken) {
    await startLoop();
  }
  console.log(`[Muusic Bridge] ouvindo em http://${HOST}:${PORT}`);
});
