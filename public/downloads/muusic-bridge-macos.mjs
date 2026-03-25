#!/usr/bin/env node
/* global fetch, setInterval, clearInterval, Buffer, console */

import { createServer } from 'http';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { homedir } from 'os';
import { dirname, join } from 'path';
import { mkdir, readFile, writeFile } from 'fs/promises';

const execFileAsync = promisify(execFile);
const PORT = 43821;
const HOST = '127.0.0.1';
const CONFIG_PATH = join(homedir(), 'Library', 'Application Support', 'Muusic Bridge', 'config.json');

let syncTimer = null;
let lastSyncAt = null;
let lastNowPlaying = null;
let cachedConfig = null;

async function ensureConfigDir() {
  await mkdir(dirname(CONFIG_PATH), { recursive: true });
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
  return payload.nowPlaying || null;
}

async function startLoop() {
  if (syncTimer) return;
  syncTimer = setInterval(() => {
    pushNowPlaying().catch(() => {});
  }, 5000);
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
      paired: Boolean(config.deviceToken),
      deviceId: config.deviceId || null,
      deviceName: config.deviceName || 'Muusic Bridge Mac',
      lastSyncAt,
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
      apiBaseUrl: String(body.apiBaseUrl || '').trim(),
      deviceToken: String(body.deviceToken || '').trim(),
      deviceId: String(body.deviceId || '').trim(),
      deviceName: String(body.deviceName || 'Muusic Bridge Mac').trim()
    });
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

  if (req.method === 'POST' && req.url === '/stop-sync') {
    if (syncTimer) clearInterval(syncTimer);
    syncTimer = null;
    sendJson(res, 200, { ok: true });
    return;
  }

  sendJson(res, 404, { error: 'Not found' });
});

server.listen(PORT, HOST, async () => {
  const config = await loadConfig();
  if (config.deviceToken) {
    await startLoop();
  }
  console.log(`[Muusic Bridge] ouvindo em http://${HOST}:${PORT}`);
});
