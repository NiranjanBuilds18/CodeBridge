export type ItemType = 'code' | 'text' | 'file';

export interface TransferItem {
  id: string;
  roomId: string;
  type: ItemType;
  title: string;
  language?: string;
  content?: string;
  filename?: string;
  fileSize?: number;
  mimeType?: string;
  downloadUrl?: string;
  storagePath?: string;
  createdAt: number;
  updatedAt?: number;
  senderDevice?: string;
}

export interface PeerInfo {
  id: string;
  role: 'laptop' | 'phone';
  deviceName: string;
  joinedAt: number;
}

export interface RoomMetadata {
  id: string;
  code: string;
  name?: string;
  createdAt: number;
  lastAccessedAt: number;
  itemCount: number;
  peers: PeerInfo[];
  items: TransferItem[];
}

export interface SupabasePublicConfig {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  isConfigured: boolean;
}

export type WSClientMessage =
  | { type: 'join'; roomId: string; role: 'laptop' | 'phone'; deviceName: string; adminToken?: string }
  | { type: 'ping' }
  | { type: 'delete_item'; roomId: string; itemId: string }
  | { type: 'clear_items'; roomId: string }
  | { type: 'delete_room'; roomId: string };

export type WSServerMessage =
  | { type: 'joined'; peerId: string; room: RoomMetadata }
  | { type: 'peer_joined'; peer: PeerInfo }
  | { type: 'peer_left'; peerId: string; role: 'laptop' | 'phone' }
  | { type: 'new_item'; item: TransferItem }
  | { type: 'item_updated'; item: TransferItem }
  | { type: 'item_deleted'; itemId: string }
  | { type: 'items_cleared'; roomId: string }
  | { type: 'room_deleted'; roomId: string }
  | { type: 'pong' }
  | { type: 'error'; message: string };

export interface NetworkInfo {
  suggestedUrl: string;
  lanIps: string[];
  publicUrl?: string;
  port: number;
  supabase?: SupabasePublicConfig;
}
