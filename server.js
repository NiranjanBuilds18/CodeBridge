// server.ts
import express from "express";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import path from "path";
import fs from "fs";
import os from "os";
import crypto from "crypto";
import multer from "multer";
import dotenv from "dotenv";

// src/server/supabase.ts
import { createClient } from "@supabase/supabase-js";
function sanitizeSupabaseUrl(rawUrl) {
  if (!rawUrl) return "";
  let url = rawUrl.trim().replace(/^["']|["']$/g, "").trim();
  if (!url) return "";
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }
  try {
    const parsed = new URL(url);
    return parsed.origin;
  } catch {
    return url.replace(/\/+$/, "").replace(/\/rest\/v1\/?$/i, "").replace(/\/+$/, "");
  }
}
var rawSupabaseUrl = process.env.SUPABASE_URL;
var supabaseUrl = sanitizeSupabaseUrl(rawSupabaseUrl);
var supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim().replace(/^["']|["']$/g, "");
var supabaseAnonKey = process.env.SUPABASE_ANON_KEY?.trim().replace(/^["']|["']$/g, "");
var STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET?.trim().replace(/^["']|["']$/g, "") || "codebridge-files";
var supabaseAdmin = null;
if (supabaseUrl && supabaseServiceRoleKey) {
  try {
    supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
    console.log(`[CodeBridge:Supabase] Initialized Supabase Admin client with PostgreSQL & Storage (URL: ${supabaseUrl})`);
  } catch (err) {
    console.error("[CodeBridge:Supabase] Error initializing client:", err);
  }
} else {
  console.log("[CodeBridge:Supabase] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set. Using local disk fallback.");
}
function isSupabaseConfigured() {
  return !!(supabaseAdmin && supabaseUrl);
}
function getPublicSupabaseConfig() {
  return {
    supabaseUrl: supabaseUrl || void 0,
    supabaseAnonKey: supabaseAnonKey || void 0,
    isConfigured: isSupabaseConfigured()
  };
}
async function ensureStorageBucket() {
  if (!supabaseAdmin) return;
  try {
    const { data: buckets } = await supabaseAdmin.storage.listBuckets();
    const exists = buckets?.some((b) => b.id === STORAGE_BUCKET);
    if (!exists) {
      const { error } = await supabaseAdmin.storage.createBucket(STORAGE_BUCKET, {
        public: true,
        fileSizeLimit: 52428800
        // 50MB
      });
      if (error && !error.message?.includes("already exists")) {
        console.error("[CodeBridge:Supabase] Error creating storage bucket:", error);
      } else {
        console.log(`[CodeBridge:Supabase] Created Supabase Storage bucket: "${STORAGE_BUCKET}"`);
      }
    }
  } catch (err) {
    console.error("[CodeBridge:Supabase] Bucket verification error:", err);
  }
}
async function dbCreateRoom(room) {
  if (!supabaseAdmin) return;
  const { error } = await supabaseAdmin.from("rooms").insert({
    id: room.id,
    code: room.code,
    name: room.name,
    admin_token: room.adminToken,
    created_at: (/* @__PURE__ */ new Date()).toISOString(),
    last_accessed_at: (/* @__PURE__ */ new Date()).toISOString()
  });
  if (error) throw new Error(`Supabase error creating room: ${error.message}`);
}
async function dbGetRoomByCodeOrId(codeOrId) {
  if (!supabaseAdmin) return null;
  const clean = codeOrId.trim();
  let query = supabaseAdmin.from("rooms").select("*");
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clean);
  if (isUuid) {
    query = query.eq("id", clean);
  } else {
    const normalized = clean.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    query = query.ilike("code", `%${normalized}%`);
  }
  const { data, error } = await query.limit(1).maybeSingle();
  if (error || !data) return null;
  return {
    id: data.id,
    code: data.code,
    name: data.name,
    createdAt: new Date(data.created_at).getTime(),
    lastAccessedAt: new Date(data.last_accessed_at).getTime(),
    adminToken: data.admin_token
  };
}
async function dbTouchRoom(roomId) {
  if (!supabaseAdmin) return;
  await supabaseAdmin.from("rooms").update({ last_accessed_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", roomId);
}
async function dbDeleteRoom(roomId) {
  if (!supabaseAdmin) return;
  try {
    const { data: files } = await supabaseAdmin.storage.from(STORAGE_BUCKET).list(roomId);
    if (files && files.length > 0) {
      const pathsToDelete = files.map((f) => `${roomId}/${f.name}`);
      await supabaseAdmin.storage.from(STORAGE_BUCKET).remove(pathsToDelete);
    }
  } catch (err) {
    console.error("[CodeBridge:Supabase] Error deleting storage files for room:", err);
  }
  const { error } = await supabaseAdmin.from("rooms").delete().eq("id", roomId);
  if (error) throw new Error(`Supabase error deleting room: ${error.message}`);
}
async function dbGetRoomItems(roomId) {
  if (!supabaseAdmin) return [];
  const { data, error } = await supabaseAdmin.from("room_items").select("*").eq("room_id", roomId).order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map((row) => ({
    id: row.id,
    roomId: row.room_id,
    type: row.type,
    title: row.title,
    language: row.language || void 0,
    content: row.content || void 0,
    filename: row.filename || void 0,
    fileSize: row.file_size ? Number(row.file_size) : void 0,
    mimeType: row.mime_type || void 0,
    storagePath: row.storage_path || void 0,
    downloadUrl: `/api/rooms/${row.room_id}/files/${row.id}`,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : void 0,
    senderDevice: row.sender_device || "Device"
  }));
}
async function dbCreateSnippet(item) {
  if (!supabaseAdmin) throw new Error("Supabase not configured");
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const { data, error } = await supabaseAdmin.from("room_items").insert({
    id: item.id,
    room_id: item.roomId,
    type: item.type,
    title: item.title,
    language: item.language,
    content: item.content,
    sender_device: item.senderDevice || "Device",
    created_at: now,
    updated_at: now
  }).select().single();
  if (error || !data) throw new Error(`Supabase error inserting snippet: ${error?.message}`);
  return {
    id: data.id,
    roomId: data.room_id,
    type: data.type,
    title: data.title,
    language: data.language,
    content: data.content,
    createdAt: new Date(data.created_at).getTime(),
    senderDevice: data.sender_device
  };
}
async function dbUploadFile(roomId, itemId, fileBuffer, originalFilename, mimeType, senderDevice) {
  if (!supabaseAdmin) throw new Error("Supabase not configured");
  const safeFilename = originalFilename.replace(/[^a-zA-Z0-9._\-]/g, "_");
  const storagePath = `${roomId}/${itemId}_${safeFilename}`;
  const { error: uploadError } = await supabaseAdmin.storage.from(STORAGE_BUCKET).upload(storagePath, fileBuffer, {
    contentType: mimeType,
    upsert: true
  });
  if (uploadError) {
    throw new Error(`Supabase Storage upload failed: ${uploadError.message}`);
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const { data, error: insertError } = await supabaseAdmin.from("room_items").insert({
    id: itemId,
    room_id: roomId,
    type: "file",
    title: safeFilename,
    filename: safeFilename,
    file_size: fileBuffer.length,
    mime_type: mimeType,
    storage_path: storagePath,
    download_url: `/api/rooms/${roomId}/files/${itemId}`,
    sender_device: senderDevice || "Device",
    created_at: now,
    updated_at: now
  }).select().single();
  if (insertError || !data) {
    throw new Error(`Supabase error inserting file metadata: ${insertError?.message}`);
  }
  return {
    id: data.id,
    roomId: data.room_id,
    type: "file",
    title: data.title,
    filename: data.filename,
    fileSize: Number(data.file_size),
    mimeType: data.mime_type,
    storagePath: data.storage_path,
    downloadUrl: `/api/rooms/${roomId}/files/${itemId}`,
    createdAt: new Date(data.created_at).getTime(),
    senderDevice: data.sender_device
  };
}
async function dbDownloadFile(storagePath) {
  if (!supabaseAdmin) return null;
  const { data, error } = await supabaseAdmin.storage.from(STORAGE_BUCKET).download(storagePath);
  if (error || !data) return null;
  const arrayBuffer = await data.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    mimeType: data.type
  };
}
async function dbRenameItem(roomId, itemId, newTitle) {
  if (!supabaseAdmin) return null;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const { data, error } = await supabaseAdmin.from("room_items").update({
    title: newTitle,
    filename: newTitle,
    updated_at: now
  }).eq("id", itemId).eq("room_id", roomId).select().single();
  if (error || !data) return null;
  return {
    id: data.id,
    roomId: data.room_id,
    type: data.type,
    title: data.title,
    filename: data.filename,
    language: data.language,
    content: data.content,
    fileSize: data.file_size ? Number(data.file_size) : void 0,
    mimeType: data.mime_type,
    storagePath: data.storage_path,
    downloadUrl: data.download_url,
    createdAt: new Date(data.created_at).getTime(),
    updatedAt: new Date(data.updated_at).getTime(),
    senderDevice: data.sender_device
  };
}
async function dbDeleteItem(roomId, itemId) {
  if (!supabaseAdmin) return false;
  const { data: item } = await supabaseAdmin.from("room_items").select("storage_path").eq("id", itemId).single();
  if (item?.storage_path) {
    try {
      await supabaseAdmin.storage.from(STORAGE_BUCKET).remove([item.storage_path]);
    } catch (err) {
      console.error("[CodeBridge:Supabase] Error removing storage object:", err);
    }
  }
  const { error } = await supabaseAdmin.from("room_items").delete().eq("id", itemId).eq("room_id", roomId);
  return !error;
}
async function dbClearRoomItems(roomId) {
  if (!supabaseAdmin) return false;
  try {
    const { data: files } = await supabaseAdmin.storage.from(STORAGE_BUCKET).list(roomId);
    if (files && files.length > 0) {
      const pathsToDelete = files.map((f) => `${roomId}/${f.name}`);
      await supabaseAdmin.storage.from(STORAGE_BUCKET).remove(pathsToDelete);
    }
  } catch (err) {
    console.error("[CodeBridge:Supabase] Error clearing bucket files:", err);
  }
  const { error } = await supabaseAdmin.from("room_items").delete().eq("room_id", roomId);
  return !error;
}
async function broadcastSupabaseRealtime(roomId, eventName, payload) {
  if (!supabaseAdmin) return;
  try {
    const channel = supabaseAdmin.channel(`room:${roomId}`);
    await channel.send({
      type: "broadcast",
      event: eventName,
      payload
    });
  } catch (err) {
  }
}

// server.ts
dotenv.config();
var DATA_DIR = path.resolve(process.cwd(), "data");
var ROOMS_FILE = path.join(DATA_DIR, "rooms.json");
var ITEMS_DIR = path.join(DATA_DIR, "items");
var UPLOADS_DIR = path.join(DATA_DIR, "uploads");
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(ITEMS_DIR, { recursive: true });
fs.mkdirSync(UPLOADS_DIR, { recursive: true });
var rooms = /* @__PURE__ */ new Map();
var roomItems = /* @__PURE__ */ new Map();
var roomPeers = /* @__PURE__ */ new Map();
var failedAttemptsByIp = /* @__PURE__ */ new Map();
function checkRateLimit(ip) {
  const now = Date.now();
  const record = failedAttemptsByIp.get(ip);
  if (!record) return true;
  if (now - record.lastAttempt > 6e4) {
    failedAttemptsByIp.delete(ip);
    return true;
  }
  return record.count < 10;
}
function recordFailedAttempt(ip) {
  const now = Date.now();
  const record = failedAttemptsByIp.get(ip) || { count: 0, lastAttempt: now };
  record.count += 1;
  record.lastAttempt = now;
  failedAttemptsByIp.set(ip, record);
}
function loadDiskStorage() {
  try {
    if (fs.existsSync(ROOMS_FILE)) {
      const data = fs.readFileSync(ROOMS_FILE, "utf-8");
      const parsed = JSON.parse(data);
      for (const r of parsed) {
        rooms.set(r.id, r);
        roomPeers.set(r.id, /* @__PURE__ */ new Map());
        const itemsFile = path.join(ITEMS_DIR, `${r.id}.json`);
        if (fs.existsSync(itemsFile)) {
          try {
            const itemsData = fs.readFileSync(itemsFile, "utf-8");
            const itemsList = JSON.parse(itemsData);
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
    console.error("[CodeBridge] Error reading local fallback storage:", err);
  }
}
loadDiskStorage();
function saveRoomsToDisk() {
  try {
    const list = Array.from(rooms.values());
    fs.writeFileSync(ROOMS_FILE, JSON.stringify(list, null, 2), "utf-8");
  } catch (err) {
    console.error("[CodeBridge] Error saving rooms to disk:", err);
  }
}
function saveRoomItemsToDisk(roomId) {
  try {
    const items = roomItems.get(roomId) || [];
    const itemsFile = path.join(ITEMS_DIR, `${roomId}.json`);
    fs.writeFileSync(itemsFile, JSON.stringify(items, null, 2), "utf-8");
  } catch (err) {
    console.error(`[CodeBridge] Error saving items for room ${roomId}:`, err);
  }
}
function generateUniqueCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "CB-";
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(crypto.randomInt(0, chars.length));
  }
  code += "-";
  for (let i = 0; i < 3; i++) {
    code += chars.charAt(crypto.randomInt(0, chars.length));
  }
  return code;
}
function formatRoomMetadata(room, itemsList) {
  const items = itemsList || roomItems.get(room.id) || [];
  const peersMap = roomPeers.get(room.id) || /* @__PURE__ */ new Map();
  const peers = Array.from(peersMap.values()).map((p) => ({
    id: p.id,
    role: p.role,
    deviceName: p.deviceName,
    joinedAt: p.joinedAt
  }));
  const cleanItems = items.map(({ diskPath: _, ...item }) => item);
  return {
    id: room.id,
    code: room.code,
    name: room.name,
    createdAt: room.createdAt,
    lastAccessedAt: room.lastAccessedAt,
    itemCount: cleanItems.length,
    peers,
    items: cleanItems
  };
}
function broadcastToRoom(roomId, message, excludeSocketId) {
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
  if (isSupabaseConfigured()) {
    broadcastSupabaseRealtime(roomId, message.type, message);
  }
}
var app = express();
var httpServer = createServer(app);
var upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }
  // 50MB
});
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
function getLanIps() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === "IPv4" && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }
  return ips;
}
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    storageMode: isSupabaseConfigured() ? "supabase" : "local_disk",
    supabaseConfigured: isSupabaseConfigured(),
    activeRooms: rooms.size,
    uptime: process.uptime(),
    timestamp: Date.now()
  });
});
app.get("/api/network-info", (req, res) => {
  const lanIps = getLanIps();
  const envAppUrl = process.env.APP_URL;
  const host = req.headers.host || "localhost:3000";
  const proto = req.headers["x-forwarded-proto"] || (req.secure ? "https" : "http");
  const detectedUrl = `${proto}://${host}`;
  res.json({
    suggestedUrl: envAppUrl || detectedUrl,
    lanIps,
    publicUrl: envAppUrl || void 0,
    port: 3e3,
    supabase: getPublicSupabaseConfig()
  });
});
app.post("/api/rooms", async (req, res) => {
  try {
    const customCode = typeof req.body.customCode === "string" ? req.body.customCode.trim() : "";
    const roomName = typeof req.body.name === "string" ? req.body.name.trim().slice(0, 50) : "";
    let code = customCode ? customCode.toUpperCase() : generateUniqueCode();
    if (customCode) {
      if (customCode.length < 3 || customCode.length > 24) {
        res.status(400).json({ error: "Room code must be between 3 and 24 characters." });
        return;
      }
    }
    const id = crypto.randomUUID();
    const adminToken = crypto.randomBytes(24).toString("hex");
    const now = Date.now();
    const newRoom = {
      id,
      code,
      name: roomName || `Room ${code}`,
      createdAt: now,
      lastAccessedAt: now,
      adminToken
    };
    if (isSupabaseConfigured()) {
      try {
        await dbCreateRoom(newRoom);
      } catch (err) {
        if (err.message?.includes("duplicate key") || err.message?.includes("unique constraint")) {
          res.status(409).json({ error: "This room code is already in use in Supabase. Please choose another." });
          return;
        }
        if (err.message?.includes("schema cache") || err.message?.includes("PGRST205")) {
          console.warn('[CodeBridge:Supabase] Schema table "rooms" not found in Supabase project yet. Storing in persistent local cache until migration is run in Supabase SQL Editor.');
        } else {
          throw err;
        }
      }
    }
    rooms.set(id, newRoom);
    roomItems.set(id, []);
    roomPeers.set(id, /* @__PURE__ */ new Map());
    saveRoomsToDisk();
    saveRoomItemsToDisk(id);
    res.status(201).json({
      ...formatRoomMetadata(newRoom, []),
      adminToken
    });
  } catch (err) {
    console.error("Error creating room:", err);
    res.status(500).json({ error: err.message || "Failed to create room" });
  }
});
app.get("/api/rooms/:idOrCode", async (req, res) => {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  if (!checkRateLimit(ip)) {
    res.status(429).json({
      error: "Too many failed lookup attempts. Please wait 30 seconds before trying again."
    });
    return;
  }
  const query = req.params.idOrCode.trim();
  try {
    let room = null;
    let itemsList = [];
    if (isSupabaseConfigured()) {
      const remoteRoom = await dbGetRoomByCodeOrId(query);
      if (remoteRoom) {
        room = remoteRoom;
        itemsList = await dbGetRoomItems(room.id);
        await dbTouchRoom(room.id);
        rooms.set(room.id, room);
        if (!roomPeers.has(room.id)) roomPeers.set(room.id, /* @__PURE__ */ new Map());
      }
    }
    if (!room) {
      room = rooms.get(query) || null;
      if (!room) {
        const cleanQuery = query.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
        for (const r of rooms.values()) {
          if (r.code.replace(/[^A-Za-z0-9]/g, "").toUpperCase() === cleanQuery || r.id === query) {
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
      res.status(404).json({ error: "Room not found. Please verify the code." });
      return;
    }
    res.json(formatRoomMetadata(room, itemsList));
  } catch (err) {
    console.error("Error fetching room:", err);
    res.status(500).json({ error: err.message || "Error fetching room" });
  }
});
app.post("/api/rooms/:id/items", async (req, res) => {
  const roomId = req.params.id;
  const { type, content, title, language, senderDevice } = req.body;
  if (!content || typeof content !== "string" || content.trim().length === 0) {
    res.status(400).json({ error: "Content cannot be empty" });
    return;
  }
  if (content.length > 5e6) {
    res.status(400).json({ error: "Content exceeds 5MB text limit" });
    return;
  }
  try {
    const itemId = crypto.randomUUID();
    const itemTitle = (title || "").slice(0, 100) || (type === "code" ? "Code Snippet" : "Note");
    let item = null;
    if (isSupabaseConfigured()) {
      try {
        item = await dbCreateSnippet({
          id: itemId,
          roomId,
          type: type === "code" ? "code" : "text",
          title: itemTitle,
          language: language ? String(language).slice(0, 30) : void 0,
          content,
          senderDevice: senderDevice ? String(senderDevice).slice(0, 60) : "Device"
        });
        await dbTouchRoom(roomId);
      } catch (err) {
        if (err.message?.includes("schema cache") || err.message?.includes("PGRST205")) {
          console.warn('[CodeBridge:Supabase] Schema table "room_items" not found in Supabase project yet. Saving snippet to persistent local disk storage.');
        } else {
          throw err;
        }
      }
    }
    if (!item) {
      const now = Date.now();
      const localItem = {
        id: itemId,
        roomId,
        type: type === "code" ? "code" : "text",
        title: itemTitle,
        language: language ? String(language).slice(0, 30) : void 0,
        content,
        createdAt: now,
        senderDevice: senderDevice ? String(senderDevice).slice(0, 60) : "Device"
      };
      const items = roomItems.get(roomId) || [];
      items.unshift(localItem);
      roomItems.set(roomId, items);
      saveRoomItemsToDisk(roomId);
      item = localItem;
    }
    broadcastToRoom(roomId, {
      type: "new_item",
      item
    });
    res.status(201).json({ success: true, item });
  } catch (err) {
    console.error("Error creating snippet:", err);
    res.status(500).json({ error: err.message || "Failed to save snippet" });
  }
});
app.post("/api/rooms/:id/files", upload.any(), async (req, res) => {
  const roomId = req.params.id;
  const files = req.files || [];
  if (!files || files.length === 0) {
    res.status(400).json({ error: "No files were uploaded" });
    return;
  }
  try {
    const senderDevice = req.body.senderDevice ? String(req.body.senderDevice).slice(0, 60) : "Device";
    const newItems = [];
    for (const file of files) {
      const itemId = crypto.randomUUID();
      const originalName = path.basename(file.originalname);
      const mimeType = file.mimetype || "application/octet-stream";
      let uploadedItem = null;
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
        } catch (err) {
          if (err.message?.includes("schema cache") || err.message?.includes("PGRST205")) {
            console.warn('[CodeBridge:Supabase] Schema table "room_items" not found in Supabase project yet. Falling back to local disk storage for upload.');
          } else {
            throw err;
          }
        }
      }
      if (uploadedItem) {
        newItems.push(uploadedItem);
        broadcastToRoom(roomId, {
          type: "new_item",
          item: uploadedItem
        });
      } else {
        const safeName = originalName.replace(/[^a-zA-Z0-9._\-]/g, "_");
        const roomUploadDir = path.join(UPLOADS_DIR, roomId);
        fs.mkdirSync(roomUploadDir, { recursive: true });
        const filePath = path.join(roomUploadDir, `${itemId}_${safeName}`);
        fs.writeFileSync(filePath, file.buffer);
        const localItem = {
          id: itemId,
          roomId,
          type: "file",
          title: originalName,
          filename: originalName,
          fileSize: file.size,
          mimeType,
          downloadUrl: `/api/rooms/${roomId}/files/${itemId}`,
          diskPath: filePath,
          createdAt: Date.now(),
          senderDevice
        };
        const items = roomItems.get(roomId) || [];
        items.unshift(localItem);
        roomItems.set(roomId, items);
        saveRoomItemsToDisk(roomId);
        const { diskPath: _, ...cleanItem } = localItem;
        newItems.push(cleanItem);
        broadcastToRoom(roomId, {
          type: "new_item",
          item: cleanItem
        });
      }
    }
    if (isSupabaseConfigured()) {
      await dbTouchRoom(roomId);
    }
    res.status(201).json({ success: true, items: newItems });
  } catch (err) {
    console.error("Error uploading files:", err);
    res.status(500).json({ error: err.message || "File upload failed" });
  }
});
app.get("/api/rooms/:id/files/:itemId", async (req, res) => {
  const { id: roomId, itemId } = req.params;
  try {
    if (isSupabaseConfigured()) {
      try {
        const items2 = await dbGetRoomItems(roomId);
        const item2 = items2.find((i) => i.id === itemId);
        if (item2 && item2.storagePath) {
          const fileData = await dbDownloadFile(item2.storagePath);
          if (fileData) {
            res.setHeader("Content-Type", fileData.mimeType || item2.mimeType || "application/octet-stream");
            res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(item2.filename || item2.title)}"`);
            res.setHeader("Content-Length", fileData.buffer.length);
            res.send(fileData.buffer);
            return;
          }
        }
      } catch (err) {
      }
    }
    const items = roomItems.get(roomId) || [];
    const item = items.find((i) => i.id === itemId);
    if (!item || !item.diskPath || !fs.existsSync(item.diskPath)) {
      res.status(404).json({ error: "File not found on storage" });
      return;
    }
    res.setHeader("Content-Type", item.mimeType || "application/octet-stream");
    res.download(item.diskPath, item.filename || item.title);
  } catch (err) {
    console.error("Error downloading file:", err);
    res.status(500).json({ error: "Error downloading file" });
  }
});
app.patch("/api/rooms/:id/items/:itemId", async (req, res) => {
  const { id: roomId, itemId } = req.params;
  const { title } = req.body;
  if (!title || typeof title !== "string" || title.trim().length === 0) {
    res.status(400).json({ error: "Title cannot be empty" });
    return;
  }
  try {
    let updatedItem = null;
    if (isSupabaseConfigured()) {
      try {
        updatedItem = await dbRenameItem(roomId, itemId, title.trim());
      } catch (err) {
        if (!err.message?.includes("schema cache") && !err.message?.includes("PGRST205")) {
          console.error("Error renaming item in Supabase:", err);
        }
      }
    }
    const items = roomItems.get(roomId) || [];
    const item = items.find((i) => i.id === itemId);
    if (item) {
      item.title = title.trim();
      if (item.type === "file") item.filename = item.title;
      item.updatedAt = Date.now();
      saveRoomItemsToDisk(roomId);
      const { diskPath: _, ...clean } = item;
      if (!updatedItem) updatedItem = clean;
    }
    if (!updatedItem) {
      res.status(404).json({ error: "Item not found" });
      return;
    }
    broadcastToRoom(roomId, {
      type: "item_updated",
      item: updatedItem
    });
    res.json({ success: true, item: updatedItem });
  } catch (err) {
    console.error("Error renaming item:", err);
    res.status(500).json({ error: "Failed to rename item" });
  }
});
app.delete("/api/rooms/:id/items/:itemId", async (req, res) => {
  const { id: roomId, itemId } = req.params;
  try {
    if (isSupabaseConfigured()) {
      try {
        await dbDeleteItem(roomId, itemId);
      } catch (err) {
        if (!err.message?.includes("schema cache") && !err.message?.includes("PGRST205")) {
          console.error("Error deleting item from Supabase:", err);
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
        }
      }
      saveRoomItemsToDisk(roomId);
    }
    broadcastToRoom(roomId, {
      type: "item_deleted",
      itemId
    });
    res.json({ success: true, message: "Item deleted permanently" });
  } catch (err) {
    console.error("Error deleting item:", err);
    res.status(500).json({ error: "Failed to delete item" });
  }
});
app.delete("/api/rooms/:id/items", async (req, res) => {
  const roomId = req.params.id;
  try {
    if (isSupabaseConfigured()) {
      try {
        await dbClearRoomItems(roomId);
      } catch (err) {
        if (!err.message?.includes("schema cache") && !err.message?.includes("PGRST205")) {
          console.error("Error clearing items from Supabase:", err);
        }
      }
    }
    const items = roomItems.get(roomId) || [];
    for (const item of items) {
      if (item.diskPath && fs.existsSync(item.diskPath)) {
        try {
          fs.unlinkSync(item.diskPath);
        } catch {
        }
      }
    }
    roomItems.set(roomId, []);
    saveRoomItemsToDisk(roomId);
    broadcastToRoom(roomId, {
      type: "items_cleared",
      roomId
    });
    res.json({ success: true, message: "All items cleared" });
  } catch (err) {
    console.error("Error clearing items:", err);
    res.status(500).json({ error: "Failed to clear items" });
  }
});
app.delete("/api/rooms/:id", async (req, res) => {
  const roomId = req.params.id;
  try {
    broadcastToRoom(roomId, {
      type: "room_deleted",
      roomId
    });
    const peersMap = roomPeers.get(roomId);
    if (peersMap) {
      for (const peer of peersMap.values()) {
        try {
          peer.ws.close(1e3, "Room deleted");
        } catch {
        }
      }
    }
    if (isSupabaseConfigured()) {
      try {
        await dbDeleteRoom(roomId);
      } catch (err) {
        if (!err.message?.includes("schema cache") && !err.message?.includes("PGRST205")) {
          console.error("Error deleting room from Supabase:", err);
        }
      }
    }
    const roomUploadDir = path.join(UPLOADS_DIR, roomId);
    if (fs.existsSync(roomUploadDir)) {
      try {
        fs.rmSync(roomUploadDir, { recursive: true, force: true });
      } catch {
      }
    }
    const itemsFile = path.join(ITEMS_DIR, `${roomId}.json`);
    if (fs.existsSync(itemsFile)) {
      try {
        fs.unlinkSync(itemsFile);
      } catch {
      }
    }
    rooms.delete(roomId);
    roomItems.delete(roomId);
    roomPeers.delete(roomId);
    saveRoomsToDisk();
    res.json({ success: true, message: "Room permanently deleted" });
  } catch (err) {
    console.error("Error deleting room:", err);
    res.status(500).json({ error: "Failed to delete room" });
  }
});
var wss = new WebSocketServer({ noServer: true });
httpServer.on("upgrade", (request, socket, head) => {
  const url = new URL(request.url || "", `http://${request.headers.host || "localhost"}`);
  if (url.pathname === "/ws") {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  } else {
    socket.destroy();
  }
});
wss.on("connection", (ws) => {
  let attachedRoomId = null;
  let peerId = null;
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
  }, 3e4);
  ws.on("pong", () => {
    isAlive = true;
  });
  ws.on("message", async (raw) => {
    try {
      const data = JSON.parse(raw.toString());
      if (data.type === "ping") {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "pong" }));
        }
        return;
      }
      if (data.type === "join") {
        let room = rooms.get(data.roomId) || null;
        let itemsList = [];
        if (isSupabaseConfigured()) {
          const remote = await dbGetRoomByCodeOrId(data.roomId);
          if (remote) {
            room = remote;
            itemsList = await dbGetRoomItems(room.id);
            rooms.set(room.id, room);
          }
        }
        if (!room) {
          ws.send(JSON.stringify({ type: "error", message: "Room not found or deleted" }));
          return;
        }
        peerId = crypto.randomUUID();
        attachedRoomId = room.id;
        const peer = {
          id: peerId,
          role: data.role || "phone",
          deviceName: data.deviceName || (data.role === "laptop" ? "Desktop" : "Mobile"),
          joinedAt: Date.now(),
          ws,
          isAlive: true
        };
        let peersMap = roomPeers.get(room.id);
        if (!peersMap) {
          peersMap = /* @__PURE__ */ new Map();
          roomPeers.set(room.id, peersMap);
        }
        peersMap.set(peerId, peer);
        if (!itemsList.length) {
          itemsList = roomItems.get(room.id) || [];
        }
        ws.send(
          JSON.stringify({
            type: "joined",
            peerId,
            room: formatRoomMetadata(room, itemsList)
          })
        );
        broadcastToRoom(
          room.id,
          {
            type: "peer_joined",
            peer: {
              id: peer.id,
              role: peer.role,
              deviceName: peer.deviceName,
              joinedAt: peer.joinedAt
            }
          },
          peerId
        );
        return;
      }
    } catch {
    }
  });
  ws.on("close", () => {
    clearInterval(pingInterval);
    if (attachedRoomId && peerId) {
      const peersMap = roomPeers.get(attachedRoomId);
      if (peersMap) {
        const peer = peersMap.get(peerId);
        const role = peer ? peer.role : "phone";
        peersMap.delete(peerId);
        broadcastToRoom(attachedRoomId, {
          type: "peer_left",
          peerId,
          role
        });
      }
    }
  });
});
async function startServer() {
  if (isSupabaseConfigured()) {
    await ensureStorageBucket();
  }
  const isProduction = process.env.NODE_ENV === "production";
  if (!isProduction) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.resolve(distPath, "index.html"));
    });
  }
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3e3;
  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`[CodeBridge] Server running on http://0.0.0.0:${PORT}`);
  });
}
startServer();
