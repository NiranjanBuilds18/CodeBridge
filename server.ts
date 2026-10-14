import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';
import multer from 'multer';
import dotenv from 'dotenv';

// Load environment variables from .env
dotenv.config();

import type {
  TransferItem,
  PeerInfo,
  RoomMetadata,
  WSClientMessage,
  WSServerMessage,
} from './src/types.js';

import {
  isSupabaseConfigured,
  getPublicSupabaseConfig,
  ensureStorageBucket,
  dbCreateRoom,
  dbGetRoomByCodeOrId,
  dbTouchRoom,
  dbDeleteRoom,
  dbGetRoomItems,
  dbCreateSnippet,
  dbUploadFile,
  dbDownloadFile,
  dbRenameItem,
  dbDeleteItem,
  dbClearRoomItems,
  broadcastSupabaseRealtime,
} from './src/server/supabase.js';

interface StoredRoom {
  id: string;
  code: string;
  name: string;
  createdAt: number;
  lastAccessedAt: number;
  adminToken: string;
}

interface StoredItem extends TransferItem {
  diskPath?: string;
}

interface PeerSocket {
  id: string;
  role: 'laptop' | 'phone';
  deviceName: string;
  joinedAt: number;
  ws: WebSocket;
  isAlive: boolean;
}

// Local Fallback Storage Directories
const DATA_DIR = path.resolve(process.cwd(), 'data');
const ROOMS_FILE = path.join(DATA_DIR, 'rooms.json');
const ITEMS_DIR = path.join(DATA_DIR, 'items');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(ITEMS_DIR, { recursive: true });
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Memory Cache & Peer Tracking
const rooms = new Map<string, StoredRoom>();
const roomItems = new Map<string, StoredItem[]>();
const roomPeers = new Map<string, Map<string, PeerSocket>>();

// Rate limiting on failed code lookups per IP (to prevent brute-force guessing)
const failedAttemptsByIp = new Map<string, { count: number; lastAttempt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = failedAttemptsByIp.get(ip);
  if (!record) return true;
  if (now - record.lastAttempt > 60_000) {
    failedAttemptsByIp.delete(ip);
    return true;
  }
  return record.count < 10;
}

function recordFailedAttempt(ip: string) {
  const now = Date.now();
  const record = failedAttemptsByIp.get(ip) || { count: 0, lastAttempt: now };
  record.count += 1;
  record.lastAttempt = now;
  failedAttemptsByIp.set(ip, record);
}

// Load disk fallback state into memory
function loadDiskStorage() {
  try {
    if (fs.existsSync(ROOMS_FILE)) {
      const data = fs.readFileSync(ROOMS_FILE, 'utf-8');
      const parsed: StoredRoom[] = JSON.parse(data);
      for (const r of parsed) {
        rooms.set(r.id, r);
        roomPeers.set(r.id, new Map());

        const itemsFile = path.join(ITEMS_DIR, `${r.id}.json`);
        if (fs.existsSync(itemsFile)) {
          try {
            const itemsData = fs.readFileSync(itemsFile, 'utf-8');
            const itemsList: StoredItem[] = JSON.parse(itemsData);
            roomItems.set(r.id, itemsList);
          } catch {
            roomItems.set(r.id, []);
          }
        } else {
          roomItems.set(r.id, []);
        }
      }
    }
  } catch (err) {
    console.error('[CodeBridge] Error reading local fallback storage:', err);
  }
}

loadDiskStorage();

function saveRoomsToDisk() {
  try {
    const list = Array.from(rooms.values());
    fs.writeFileSync(ROOMS_FILE, JSON.stringify(list, null, 2), 'utf-8');
  } catch (err) {
    console.error('[CodeBridge] Error saving rooms to disk:', err);
  }
}

function saveRoomItemsToDisk(roomId: string) {
  try {
    const items = roomItems.get(roomId) || [];
    const itemsFile = path.join(ITEMS_DIR, `${roomId}.json`);
    fs.writeFileSync(itemsFile, JSON.stringify(items, null, 2), 'utf-8');
  } catch (err) {
    console.error(`[CodeBridge] Error saving items for room ${roomId}:`, err);
  }
}

function generateUniqueCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'CB-';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(crypto.randomInt(0, chars.length));
  }
  code += '-';
  for (let i = 0; i < 3; i++) {
    code += chars.charAt(crypto.randomInt(0, chars.length));
  }
  return code;
}

function formatRoomMetadata(room: StoredRoom, itemsList?: TransferItem[]): RoomMetadata {
  const items = itemsList || roomItems.get(room.id) || [];
  const peersMap = roomPeers.get(room.id) || new Map();
  const peers: PeerInfo[] = Array.from(peersMap.values()).map((p) => ({
    id: p.id,
    role: p.role,
    deviceName: p.deviceName,
    joinedAt: p.joinedAt,
  }));

  const cleanItems: TransferItem[] = items.map(({ diskPath: _, ...item }: any) => item);

  return {
    id: room.id,
    code: room.code,
    name: room.name,
    createdAt: room.createdAt,
    lastAccessedAt: room.lastAccessedAt,
    itemCount: cleanItems.length,
    peers,
    items: cleanItems,
  };
}

function broadcastToRoom(roomId: string, message: WSServerMessage, excludeSocketId?: string) {
  // 1. Broadcast to connected WebSockets
  const peersMap = roomPeers.get(roomId);
  if (peersMap) {
    const payload = JSON.stringify(message);
    for (const peer of peersMap.values()) {
      if (excludeSocketId && peer.id === excludeSocketId) continue;
      if (peer.ws.readyState === WebSocket.OPEN) {
        peer.ws.send(payload);
      }
    }
  }

  // 2. Broadcast to Supabase Realtime channel if enabled
  if (isSupabaseConfigured()) {
    broadcastSupabaseRealtime(roomId, message.type, message);
  }
}

const app = express();
const httpServer = createServer(app);

// Use memory storage for uploads so buffers can be written to Supabase Storage directly (or disk if fallback)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

function getLanIps(): string[] {
  const interfaces = os.networkInterfaces();
  const ips: string[] = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }
  return ips;
}

// REST Endpoints
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    storageMode: isSupabaseConfigured() ? 'supabase' : 'local_disk',
    supabaseConfigured: isSupabaseConfigured(),
    activeRooms: rooms.size,
    uptime: process.uptime(),
    timestamp: Date.now(),
  });
});

app.get('/api/network-info', (req, res) => {
  const lanIps = getLanIps();
  const envAppUrl = process.env.APP_URL;
  const host = req.headers.host || 'localhost:3000';
  const proto = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
  const detectedUrl = `${proto}://${host}`;

  res.json({
    suggestedUrl: envAppUrl || detectedUrl,
    lanIps,
    publicUrl: envAppUrl || undefined,
    port: 3000,
    supabase: getPublicSupabaseConfig(),
  });
});

// Create Room
app.post('/api/rooms', async (req, res) => {
  try {
    const customCode = typeof req.body.customCode === 'string' ? req.body.customCode.trim() : '';
    const roomName = typeof req.body.name === 'string' ? req.body.name.trim().slice(0, 50) : '';

    let code = customCode ? customCode.toUpperCase() : generateUniqueCode();

    if (customCode) {
      if (customCode.length < 3 || customCode.length > 24) {
        res.status(400).json({ error: 'Room code must be between 3 and 24 characters.' });
        return;
      }
    }

    const id = crypto.randomUUID();
    const adminToken = crypto.randomBytes(24).toString('hex');
    const now = Date.now();

    const newRoom: StoredRoom = {
      id,
      code,
      name: roomName || `Room ${code}`,
      createdAt: now,
      lastAccessedAt: now,
      adminToken,
    };

    // Save to Supabase PostgreSQL if configured
    if (isSupabaseConfigured()) {
      try {
        await dbCreateRoom(newRoom);
      } catch (err: any) {
        if (err.message?.includes('duplicate key') || err.message?.includes('unique constraint')) {
          res.status(409).json({ error: 'This room code is already in use in Supabase. Please choose another.' });
          return;
        }
        if (err.message?.includes('schema cache') || err.message?.includes('PGRST205')) {
          console.warn('[CodeBridge:Supabase] Schema table "rooms" not found in Supabase project yet. Storing in persistent local cache until migration is run in Supabase SQL Editor.');
        } else {
          throw err;
        }
      }
    }

    // Keep in local cache
    rooms.set(id, newRoom);
    roomItems.set(id, []);
    roomPeers.set(id, new Map());
    saveRoomsToDisk();
    saveRoomItemsToDisk(id);

    res.status(201).json({
      ...formatRoomMetadata(newRoom, []),
      adminToken,
    });
  } catch (err: any) {
    console.error('Error creating room:', err);
    res.status(500).json({ error: err.message || 'Failed to create room' });
  }
});

// Lookup Room by Code or ID
app.get('/api/rooms/:idOrCode', async (req, res) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  if (!checkRateLimit(ip)) {
    res.status(429).json({
      error: 'Too many failed lookup attempts. Please wait 30 seconds before trying again.',
    });
    return;
  }

  const query = req.params.idOrCode.trim();

  try {
    let room: StoredRoom | null = null;
    let itemsList: TransferItem[] = [];

    // Check Supabase first if configured
    if (isSupabaseConfigured()) {
      const remoteRoom = await dbGetRoomByCodeOrId(query);
      if (remoteRoom) {
        room = remoteRoom;
        itemsList = await dbGetRoomItems(room.id);
        await dbTouchRoom(room.id);
        rooms.set(room.id, room);
        if (!roomPeers.has(room.id)) roomPeers.set(room.id, new Map());
      }
    }

    // Fallback to local memory / disk index
    if (!room) {
      room = rooms.get(query) || null;
      if (!room) {
        const cleanQuery = query.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        for (const r of rooms.values()) {
          if (r.code.replace(/[^A-Za-z0-9]/g, '').toUpperCase() === cleanQuery || r.id === query) {
            room = r;
            break;
          }
        }
      }
      if (room) {
        itemsList = roomItems.get(room.id) || [];
        room.lastAccessedAt = Date.now();
        saveRoomsToDisk();
      }
    }

    if (!room) {
      recordFailedAttempt(ip);
      res.status(404).json({ error: 'Room not found. Please verify the code.' });
      return;
    }

    res.json(formatRoomMetadata(room, itemsList));
  } catch (err: any) {
    console.error('Error fetching room:', err);
    res.status(500).json({ error: err.message || 'Error fetching room' });
  }
});

// Post Code / Text Snippet
app.post('/api/rooms/:id/items', async (req, res) => {
  const roomId = req.params.id;
  const { type, content, title, language, senderDevice } = req.body;

  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    res.status(400).json({ error: 'Content cannot be empty' });
    return;
  }

  if (content.length > 5_000_000) {
    res.status(400).json({ error: 'Content exceeds 5MB text limit' });
    return;
  }

  try {
    const itemId = crypto.randomUUID();
    const itemTitle = (title || '').slice(0, 100) || (type === 'code' ? 'Code Snippet' : 'Note');
    let item: TransferItem | null = null;

    if (isSupabaseConfigured()) {
      try {
        item = await dbCreateSnippet({
          id: itemId,
          roomId,
          type: type === 'code' ? 'code' : 'text',
          title: itemTitle,
          language: language ? String(language).slice(0, 30) : undefined,
          content,
          senderDevice: senderDevice ? String(senderDevice).slice(0, 60) : 'Device',
        });
        await dbTouchRoom(roomId);
      } catch (err: any) {
        if (err.message?.includes('schema cache') || err.message?.includes('PGRST205')) {
          console.warn('[CodeBridge:Supabase] Schema table "room_items" not found in Supabase project yet. Saving snippet to persistent local disk storage.');
        } else {
          throw err;
        }
      }
    }

    if (!item) {
      const now = Date.now();
      const localItem: StoredItem = {
        id: itemId,
        roomId,
        type: type === 'code' ? 'code' : 'text',
        title: itemTitle,
        language: language ? String(language).slice(0, 30) : undefined,
        content,
        createdAt: now,
        senderDevice: senderDevice ? String(senderDevice).slice(0, 60) : 'Device',
      };
      const items = roomItems.get(roomId) || [];
      items.unshift(localItem);
      roomItems.set(roomId, items);
      saveRoomItemsToDisk(roomId);
      item = localItem;
    }

    broadcastToRoom(roomId, {
      type: 'new_item',
      item,
    });

    res.status(201).json({ success: true, item });
  } catch (err: any) {
    console.error('Error creating snippet:', err);
    res.status(500).json({ error: err.message || 'Failed to save snippet' });
  }
});

// Upload Files to Supabase Storage (or disk fallback)
app.post('/api/rooms/:id/files', upload.any(), async (req, res) => {
  const roomId = req.params.id;
  const files = (req.files as Express.Multer.File[]) || [];

  if (!files || files.length === 0) {
    res.status(400).json({ error: 'No files were uploaded' });
    return;
  }

  try {
    const senderDevice = req.body.senderDevice ? String(req.body.senderDevice).slice(0, 60) : 'Device';
    const newItems: TransferItem[] = [];

    for (const file of files) {
      const itemId = crypto.randomUUID();
      const originalName = path.basename(file.originalname);
      const mimeType = file.mimetype || 'application/octet-stream';

      let uploadedItem: TransferItem | null = null;

      if (isSupabaseConfigured()) {
        try {
          uploadedItem = await dbUploadFile(
            roomId,
            itemId,
            file.buffer,
            originalName,
            mimeType,
            senderDevice
          );
        } catch (err: any) {
          if (err.message?.includes('schema cache') || err.message?.includes('PGRST205')) {
            console.warn('[CodeBridge:Supabase] Schema table "room_items" not found in Supabase project yet. Falling back to local disk storage for upload.');
          } else {
            throw err;
          }
        }
      }

      if (uploadedItem) {
        newItems.push(uploadedItem);
        broadcastToRoom(roomId, {
          type: 'new_item',
          item: uploadedItem,
        });
      } else {
        // Local Disk Fallback
        const safeName = originalName.replace(/[^a-zA-Z0-9._\-]/g, '_');
        const roomUploadDir = path.join(UPLOADS_DIR, roomId);
        fs.mkdirSync(roomUploadDir, { recursive: true });
        const filePath = path.join(roomUploadDir, `${itemId}_${safeName}`);
        fs.writeFileSync(filePath, file.buffer);

        const localItem: StoredItem = {
          id: itemId,
          roomId,
          type: 'file',
          title: originalName,
          filename: originalName,
          fileSize: file.size,
          mimeType,
          downloadUrl: `/api/rooms/${roomId}/files/${itemId}`,
          diskPath: filePath,
          createdAt: Date.now(),
          senderDevice,
        };

        const items = roomItems.get(roomId) || [];
        items.unshift(localItem);
        roomItems.set(roomId, items);
        saveRoomItemsToDisk(roomId);

        const { diskPath: _, ...cleanItem } = localItem;
        newItems.push(cleanItem);
        broadcastToRoom(roomId, {
          type: 'new_item',
          item: cleanItem,
        });
      }
    }

    if (isSupabaseConfigured()) {
      await dbTouchRoom(roomId);
    }

    res.status(201).json({ success: true, items: newItems });
  } catch (err: any) {
    console.error('Error uploading files:', err);
    res.status(500).json({ error: err.message || 'File upload failed' });
  }
});

// Download File (Streamed from Supabase Storage or disk)
app.get('/api/rooms/:id/files/:itemId', async (req, res) => {
  const { id: roomId, itemId } = req.params;

  try {
    if (isSupabaseConfigured()) {
      try {
        const items = await dbGetRoomItems(roomId);
        const item = items.find((i) => i.id === itemId);

        if (item && item.storagePath) {
          const fileData = await dbDownloadFile(item.storagePath);
          if (fileData) {
            res.setHeader('Content-Type', fileData.mimeType || item.mimeType || 'application/octet-stream');
            res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(item.filename || item.title)}"`);
            res.setHeader('Content-Length', fileData.buffer.length);
            res.send(fileData.buffer);
            return;
          }
        }
      } catch (err) {
        // Fall through to local disk
      }
    }

    // Local Disk Fallback
    const items = roomItems.get(roomId) || [];
    const item = items.find((i) => i.id === itemId);
    if (!item || !item.diskPath || !fs.existsSync(item.diskPath)) {
      res.status(404).json({ error: 'File not found on storage' });
      return;
    }

    res.setHeader('Content-Type', item.mimeType || 'application/octet-stream');
    res.download(item.diskPath, item.filename || item.title);
  } catch (err: any) {
    console.error('Error downloading file:', err);
    res.status(500).json({ error: 'Error downloading file' });
  }
});

// Rename Item
app.patch('/api/rooms/:id/items/:itemId', async (req, res) => {
  const { id: roomId, itemId } = req.params;
  const { title } = req.body;

  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    res.status(400).json({ error: 'Title cannot be empty' });
    return;
  }

  try {
    let updatedItem: TransferItem | null = null;

    if (isSupabaseConfigured()) {
      try {
        updatedItem = await dbRenameItem(roomId, itemId, title.trim());
      } catch (err: any) {
        if (!err.message?.includes('schema cache') && !err.message?.includes('PGRST205')) {
          console.error('Error renaming item in Supabase:', err);
        }
      }
    }

    const items = roomItems.get(roomId) || [];
    const item = items.find((i) => i.id === itemId);
    if (item) {
      item.title = title.trim();
      if (item.type === 'file') item.filename = item.title;
      item.updatedAt = Date.now();
      saveRoomItemsToDisk(roomId);
      const { diskPath: _, ...clean } = item;
      if (!updatedItem) updatedItem = clean;
    }

    if (!updatedItem) {
      res.status(404).json({ error: 'Item not found' });
      return;
    }

    broadcastToRoom(roomId, {
      type: 'item_updated',
      item: updatedItem,
    });

    res.json({ success: true, item: updatedItem });
  } catch (err: any) {
    console.error('Error renaming item:', err);
    res.status(500).json({ error: 'Failed to rename item' });
  }
});

// Delete Individual Item
app.delete('/api/rooms/:id/items/:itemId', async (req, res) => {
  const { id: roomId, itemId } = req.params;

  try {
    if (isSupabaseConfigured()) {
      try {
        await dbDeleteItem(roomId, itemId);
      } catch (err: any) {
        if (!err.message?.includes('schema cache') && !err.message?.includes('PGRST205')) {
          console.error('Error deleting item from Supabase:', err);
        }
      }
    }

    const items = roomItems.get(roomId) || [];
    const idx = items.findIndex((i) => i.id === itemId);
    if (idx !== -1) {
      const [removed] = items.splice(idx, 1);
      if (removed.diskPath && fs.existsSync(removed.diskPath)) {
        try {
          fs.unlinkSync(removed.diskPath);
        } catch {
          // ignore
        }
      }
      saveRoomItemsToDisk(roomId);
    }

    broadcastToRoom(roomId, {
      type: 'item_deleted',
      itemId,
    });

    res.json({ success: true, message: 'Item deleted permanently' });
  } catch (err: any) {
    console.error('Error deleting item:', err);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

// Clear All Items in Room
app.delete('/api/rooms/:id/items', async (req, res) => {
  const roomId = req.params.id;

  try {
    if (isSupabaseConfigured()) {
      try {
        await dbClearRoomItems(roomId);
      } catch (err: any) {
        if (!err.message?.includes('schema cache') && !err.message?.includes('PGRST205')) {
          console.error('Error clearing items from Supabase:', err);
        }
      }
    }

    const items = roomItems.get(roomId) || [];
    for (const item of items) {
      if (item.diskPath && fs.existsSync(item.diskPath)) {
        try {
          fs.unlinkSync(item.diskPath);
        } catch {
          // ignore
        }
      }
    }
    roomItems.set(roomId, []);
    saveRoomItemsToDisk(roomId);

    broadcastToRoom(roomId, {
      type: 'items_cleared',
      roomId,
    });

    res.json({ success: true, message: 'All items cleared' });
  } catch (err: any) {
    console.error('Error clearing items:', err);
    res.status(500).json({ error: 'Failed to clear items' });
  }
});

// Delete Entire Room
app.delete('/api/rooms/:id', async (req, res) => {
  const roomId = req.params.id;

  try {
    broadcastToRoom(roomId, {
      type: 'room_deleted',
      roomId,
    });

    // Close peers
    const peersMap = roomPeers.get(roomId);
    if (peersMap) {
      for (const peer of peersMap.values()) {
        try {
          peer.ws.close(1000, 'Room deleted');
        } catch {
          // ignore
        }
      }
    }

    if (isSupabaseConfigured()) {
      try {
        await dbDeleteRoom(roomId);
      } catch (err: any) {
        if (!err.message?.includes('schema cache') && !err.message?.includes('PGRST205')) {
          console.error('Error deleting room from Supabase:', err);
        }
      }
    }

    const roomUploadDir = path.join(UPLOADS_DIR, roomId);
    if (fs.existsSync(roomUploadDir)) {
      try {
        fs.rmSync(roomUploadDir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
    const itemsFile = path.join(ITEMS_DIR, `${roomId}.json`);
    if (fs.existsSync(itemsFile)) {
      try {
        fs.unlinkSync(itemsFile);
      } catch {
        // ignore
      }
    }

    rooms.delete(roomId);
    roomItems.delete(roomId);
    roomPeers.delete(roomId);
    saveRoomsToDisk();

    res.json({ success: true, message: 'Room permanently deleted' });
  } catch (err: any) {
    console.error('Error deleting room:', err);
    res.status(500).json({ error: 'Failed to delete room' });
  }
});

// WebSocket Server
const wss = new WebSocketServer({ noServer: true });

httpServer.on('upgrade', (request, socket, head) => {
  const url = new URL(request.url || '', `http://${request.headers.host || 'localhost'}`);
  if (url.pathname === '/ws') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

wss.on('connection', (ws: WebSocket) => {
  let attachedRoomId: string | null = null;
  let peerId: string | null = null;
  let isAlive = true;

  const pingInterval = setInterval(() => {
    if (!isAlive) {
      ws.terminate();
      return;
    }
    isAlive = false;
    if (ws.readyState === WebSocket.OPEN) {
      ws.ping();
    }
  }, 30_000);

  ws.on('pong', () => {
    isAlive = true;
  });

  ws.on('message', async (raw) => {
    try {
      const data = JSON.parse(raw.toString()) as WSClientMessage;

      if (data.type === 'ping') {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'pong' }));
        }
        return;
      }

      if (data.type === 'join') {
        let room: StoredRoom | null = rooms.get(data.roomId) || null;
        let itemsList: TransferItem[] = [];

        if (isSupabaseConfigured()) {
          const remote = await dbGetRoomByCodeOrId(data.roomId);
          if (remote) {
            room = remote;
            itemsList = await dbGetRoomItems(room.id);
            rooms.set(room.id, room);
          }
        }

        if (!room) {
          ws.send(JSON.stringify({ type: 'error', message: 'Room not found or deleted' }));
          return;
        }

        peerId = crypto.randomUUID();
        attachedRoomId = room.id;

        const peer: PeerSocket = {
          id: peerId,
          role: data.role || 'phone',
          deviceName: data.deviceName || (data.role === 'laptop' ? 'Desktop' : 'Mobile'),
          joinedAt: Date.now(),
          ws,
          isAlive: true,
        };

        let peersMap = roomPeers.get(room.id);
        if (!peersMap) {
          peersMap = new Map();
          roomPeers.set(room.id, peersMap);
        }
        peersMap.set(peerId, peer);

        if (!itemsList.length) {
          itemsList = roomItems.get(room.id) || [];
        }

        // Send full state to joining peer
        ws.send(
          JSON.stringify({
            type: 'joined',
            peerId,
            room: formatRoomMetadata(room, itemsList),
          } satisfies WSServerMessage)
        );

        // Notify other peers
        broadcastToRoom(
          room.id,
          {
            type: 'peer_joined',
            peer: {
              id: peer.id,
              role: peer.role,
              deviceName: peer.deviceName,
              joinedAt: peer.joinedAt,
            },
          },
          peerId
        );
        return;
      }
    } catch {
      // ignore
    }
  });

  ws.on('close', () => {
    clearInterval(pingInterval);
    if (attachedRoomId && peerId) {
      const peersMap = roomPeers.get(attachedRoomId);
      if (peersMap) {
        const peer = peersMap.get(peerId);
        const role = peer ? peer.role : 'phone';
        peersMap.delete(peerId);

        broadcastToRoom(attachedRoomId, {
          type: 'peer_left',
          peerId,
          role,
        });
      }
    }
  });
});

async function startServer() {
  // If Supabase is configured, ensure storage bucket exists
  if (isSupabaseConfigured()) {
    await ensureStorageBucket();
  }

  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`[CodeBridge] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
