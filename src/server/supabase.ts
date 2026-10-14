import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { TransferItem, RoomMetadata, SupabasePublicConfig } from '../types.js';

/**
 * Sanitizes a Supabase URL to ensure it is the root project origin
 * (e.g., "https://xyz.supabase.co") without "/rest/v1", trailing slashes, or duplicate path segments.
 * This prevents the Supabase PostgREST error: "Invalid path specified in request URL".
 */
export function sanitizeSupabaseUrl(rawUrl?: string): string {
  if (!rawUrl) return '';
  let url = rawUrl.trim().replace(/^["']|["']$/g, '').trim();
  if (!url) return '';

  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }

  try {
    const parsed = new URL(url);
    // Project URL should just be the origin (protocol + host), e.g. "https://xxxx.supabase.co"
    // Never append /rest/v1 to createClient as the SDK automatically appends /rest/v1 for table requests.
    return parsed.origin;
  } catch {
    return url.replace(/\/+$/, '').replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');
  }
}

const rawSupabaseUrl = process.env.SUPABASE_URL;
const supabaseUrl = sanitizeSupabaseUrl(rawSupabaseUrl);
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim().replace(/^["']|["']$/g, '');
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY?.trim().replace(/^["']|["']$/g, '');
const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET?.trim().replace(/^["']|["']$/g, '') || 'codebridge-files';

let supabaseAdmin: SupabaseClient | null = null;

if (supabaseUrl && supabaseServiceRoleKey) {
  try {
    supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    console.log(`[CodeBridge:Supabase] Initialized Supabase Admin client with PostgreSQL & Storage (URL: ${supabaseUrl})`);
  } catch (err) {
    console.error('[CodeBridge:Supabase] Error initializing client:', err);
  }
} else {
  console.log('[CodeBridge:Supabase] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set. Using local disk fallback.');
}

export function isSupabaseConfigured(): boolean {
  return !!(supabaseAdmin && supabaseUrl);
}

export function getPublicSupabaseConfig(): SupabasePublicConfig {
  return {
    supabaseUrl: supabaseUrl || undefined,
    supabaseAnonKey: supabaseAnonKey || undefined,
    isConfigured: isSupabaseConfigured(),
  };
}

// Ensure the storage bucket exists in Supabase
export async function ensureStorageBucket() {
  if (!supabaseAdmin) return;
  try {
    const { data: buckets } = await supabaseAdmin.storage.listBuckets();
    const exists = buckets?.some((b) => b.id === STORAGE_BUCKET);
    if (!exists) {
      const { error } = await supabaseAdmin.storage.createBucket(STORAGE_BUCKET, {
        public: true,
        fileSizeLimit: 52428800, // 50MB
      });
      if (error && !error.message?.includes('already exists')) {
        console.error('[CodeBridge:Supabase] Error creating storage bucket:', error);
      } else {
        console.log(`[CodeBridge:Supabase] Created Supabase Storage bucket: "${STORAGE_BUCKET}"`);
      }
    }
  } catch (err) {
    console.error('[CodeBridge:Supabase] Bucket verification error:', err);
  }
}

// Database operations for Rooms
export async function dbCreateRoom(room: {
  id: string;
  code: string;
  name: string;
  adminToken: string;
}): Promise<void> {
  if (!supabaseAdmin) return;
  const { error } = await supabaseAdmin.from('rooms').insert({
    id: room.id,
    code: room.code,
    name: room.name,
    admin_token: room.adminToken,
    created_at: new Date().toISOString(),
    last_accessed_at: new Date().toISOString(),
  });
  if (error) throw new Error(`Supabase error creating room: ${error.message}`);
}

export async function dbGetRoomByCodeOrId(codeOrId: string) {
  if (!supabaseAdmin) return null;
  const clean = codeOrId.trim();

  // Try matching by exact ID or case-insensitive code
  let query = supabaseAdmin.from('rooms').select('*');
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clean);

  if (isUuid) {
    query = query.eq('id', clean);
  } else {
    const normalized = clean.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    query = query.ilike('code', `%${normalized}%`);
  }

  const { data, error } = await query.limit(1).maybeSingle();
  if (error || !data) return null;

  return {
    id: data.id,
    code: data.code,
    name: data.name,
    createdAt: new Date(data.created_at).getTime(),
    lastAccessedAt: new Date(data.last_accessed_at).getTime(),
    adminToken: data.admin_token,
  };
}

export async function dbTouchRoom(roomId: string): Promise<void> {
  if (!supabaseAdmin) return;
  await supabaseAdmin
    .from('rooms')
    .update({ last_accessed_at: new Date().toISOString() })
    .eq('id', roomId);
}

export async function dbDeleteRoom(roomId: string): Promise<void> {
  if (!supabaseAdmin) return;
  // 1. Remove all files from Supabase Storage in this room folder
  try {
    const { data: files } = await supabaseAdmin.storage.from(STORAGE_BUCKET).list(roomId);
    if (files && files.length > 0) {
      const pathsToDelete = files.map((f) => `${roomId}/${f.name}`);
      await supabaseAdmin.storage.from(STORAGE_BUCKET).remove(pathsToDelete);
    }
  } catch (err) {
    console.error('[CodeBridge:Supabase] Error deleting storage files for room:', err);
  }

  // 2. Delete room from PostgreSQL (CASCADE will delete room_items)
  const { error } = await supabaseAdmin.from('rooms').delete().eq('id', roomId);
  if (error) throw new Error(`Supabase error deleting room: ${error.message}`);
}

// Database operations for Items
export async function dbGetRoomItems(roomId: string): Promise<TransferItem[]> {
  if (!supabaseAdmin) return [];
  const { data, error } = await supabaseAdmin
    .from('room_items')
    .select('*')
    .eq('room_id', roomId)
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    roomId: row.room_id,
    type: row.type,
    title: row.title,
    language: row.language || undefined,
    content: row.content || undefined,
    filename: row.filename || undefined,
    fileSize: row.file_size ? Number(row.file_size) : undefined,
    mimeType: row.mime_type || undefined,
    storagePath: row.storage_path || undefined,
    downloadUrl: `/api/rooms/${row.room_id}/files/${row.id}`,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : undefined,
    senderDevice: row.sender_device || 'Device',
  }));
}

export async function dbCreateSnippet(item: {
  id: string;
  roomId: string;
  type: 'code' | 'text';
  title: string;
  language?: string;
  content: string;
  senderDevice?: string;
}): Promise<TransferItem> {
  if (!supabaseAdmin) throw new Error('Supabase not configured');
  const now = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from('room_items')
    .insert({
      id: item.id,
      room_id: item.roomId,
      type: item.type,
      title: item.title,
      language: item.language,
      content: item.content,
      sender_device: item.senderDevice || 'Device',
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();

  if (error || !data) throw new Error(`Supabase error inserting snippet: ${error?.message}`);

  return {
    id: data.id,
    roomId: data.room_id,
    type: data.type,
    title: data.title,
    language: data.language,
    content: data.content,
    createdAt: new Date(data.created_at).getTime(),
    senderDevice: data.sender_device,
  };
}

export async function dbUploadFile(
  roomId: string,
  itemId: string,
  fileBuffer: Buffer,
  originalFilename: string,
  mimeType: string,
  senderDevice?: string
): Promise<TransferItem> {
  if (!supabaseAdmin) throw new Error('Supabase not configured');
  const safeFilename = originalFilename.replace(/[^a-zA-Z0-9._\-]/g, '_');
  const storagePath = `${roomId}/${itemId}_${safeFilename}`;

  // 1. Upload binary file buffer directly to Supabase Storage
  const { error: uploadError } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, fileBuffer, {
      contentType: mimeType,
      upsert: true,
    });

  if (uploadError) {
    throw new Error(`Supabase Storage upload failed: ${uploadError.message}`);
  }

  // 2. Insert metadata into PostgreSQL room_items table
  const now = new Date().toISOString();
  const { data, error: insertError } = await supabaseAdmin
    .from('room_items')
    .insert({
      id: itemId,
      room_id: roomId,
      type: 'file',
      title: safeFilename,
      filename: safeFilename,
      file_size: fileBuffer.length,
      mime_type: mimeType,
      storage_path: storagePath,
      download_url: `/api/rooms/${roomId}/files/${itemId}`,
      sender_device: senderDevice || 'Device',
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();

  if (insertError || !data) {
    throw new Error(`Supabase error inserting file metadata: ${insertError?.message}`);
  }

  return {
    id: data.id,
    roomId: data.room_id,
    type: 'file',
    title: data.title,
    filename: data.filename,
    fileSize: Number(data.file_size),
    mimeType: data.mime_type,
    storagePath: data.storage_path,
    downloadUrl: `/api/rooms/${roomId}/files/${itemId}`,
    createdAt: new Date(data.created_at).getTime(),
    senderDevice: data.sender_device,
  };
}

export async function dbDownloadFile(storagePath: string): Promise<{ buffer: Buffer; mimeType?: string } | null> {
  if (!supabaseAdmin) return null;
  const { data, error } = await supabaseAdmin.storage.from(STORAGE_BUCKET).download(storagePath);
  if (error || !data) return null;

  const arrayBuffer = await data.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    mimeType: data.type,
  };
}

export async function dbRenameItem(roomId: string, itemId: string, newTitle: string): Promise<TransferItem | null> {
  if (!supabaseAdmin) return null;
  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from('room_items')
    .update({
      title: newTitle,
      filename: newTitle,
      updated_at: now,
    })
    .eq('id', itemId)
    .eq('room_id', roomId)
    .select()
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    roomId: data.room_id,
    type: data.type,
    title: data.title,
    filename: data.filename,
    language: data.language,
    content: data.content,
    fileSize: data.file_size ? Number(data.file_size) : undefined,
    mimeType: data.mime_type,
    storagePath: data.storage_path,
    downloadUrl: data.download_url,
    createdAt: new Date(data.created_at).getTime(),
    updatedAt: new Date(data.updated_at).getTime(),
    senderDevice: data.sender_device,
  };
}

export async function dbDeleteItem(roomId: string, itemId: string): Promise<boolean> {
  if (!supabaseAdmin) return false;
  // Get item to find storage_path
  const { data: item } = await supabaseAdmin
    .from('room_items')
    .select('storage_path')
    .eq('id', itemId)
    .single();

  if (item?.storage_path) {
    try {
      await supabaseAdmin.storage.from(STORAGE_BUCKET).remove([item.storage_path]);
    } catch (err) {
      console.error('[CodeBridge:Supabase] Error removing storage object:', err);
    }
  }

  const { error } = await supabaseAdmin.from('room_items').delete().eq('id', itemId).eq('room_id', roomId);
  return !error;
}

export async function dbClearRoomItems(roomId: string): Promise<boolean> {
  if (!supabaseAdmin) return false;
  try {
    const { data: files } = await supabaseAdmin.storage.from(STORAGE_BUCKET).list(roomId);
    if (files && files.length > 0) {
      const pathsToDelete = files.map((f) => `${roomId}/${f.name}`);
      await supabaseAdmin.storage.from(STORAGE_BUCKET).remove(pathsToDelete);
    }
  } catch (err) {
    console.error('[CodeBridge:Supabase] Error clearing bucket files:', err);
  }

  const { error } = await supabaseAdmin.from('room_items').delete().eq('room_id', roomId);
  return !error;
}

// Broadcast event to Supabase Realtime channel
export async function broadcastSupabaseRealtime(roomId: string, eventName: string, payload: any) {
  if (!supabaseAdmin) return;
  try {
    const channel = supabaseAdmin.channel(`room:${roomId}`);
    await channel.send({
      type: 'broadcast',
      event: eventName,
      payload,
    });
  } catch (err) {
    // Non-fatal, local WS handles relay as well
  }
}
