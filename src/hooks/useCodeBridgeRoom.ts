import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient, RealtimeChannel } from '@supabase/supabase-js';
import type { TransferItem, PeerInfo, RoomMetadata, WSServerMessage, NetworkInfo } from '../types.js';
import { detectDeviceName } from '../utils/device.js';

interface UseCodeBridgeOptions {
  initialRoomCode?: string | null;
  role: 'laptop' | 'phone';
}

const STORAGE_ACTIVE_ROOM_KEY = 'codebridge_active_room_code';

export function useCodeBridgeRoom({ initialRoomCode, role }: UseCodeBridgeOptions) {
  const [room, setRoom] = useState<RoomMetadata | null>(null);
  const [items, setItems] = useState<TransferItem[]>([]);
  const [peers, setPeers] = useState<PeerInfo[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const activeRoomIdRef = useRef<string | null>(null);
  const roleRef = useRef<'laptop' | 'phone'>(role);
  roleRef.current = role;

  const supabaseChannelRef = useRef<RealtimeChannel | null>(null);

  // Fetch server network info (includes Supabase public config: url, anonKey, isConfigured)
  useEffect(() => {
    fetch('/api/network-info')
      .then((res) => res.json())
      .then((data) => setNetworkInfo(data))
      .catch((err) => console.error('Error fetching network info:', err));
  }, []);

  // Supabase Realtime Channel Subscription (Client-side, using safe public anon key)
  useEffect(() => {
    const sbConfig = networkInfo?.supabase;
    if (!room?.id || !sbConfig?.isConfigured || !sbConfig.supabaseUrl || !sbConfig.supabaseAnonKey) {
      return;
    }

    try {
      // Ensure the URL is always the root origin without /rest/v1 or trailing slashes
      let cleanUrl = sbConfig.supabaseUrl.trim().replace(/^["']|["']$/g, '').trim();
      try {
        if (!/^https?:\/\//i.test(cleanUrl)) cleanUrl = `https://${cleanUrl}`;
        cleanUrl = new URL(cleanUrl).origin;
      } catch {
        cleanUrl = cleanUrl.replace(/\/+$/, '').replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');
      }

      const supabase = createClient(cleanUrl, sbConfig.supabaseAnonKey);
      const channel = supabase.channel(`room:${room.id}`);
      supabaseChannelRef.current = channel;

      channel
        .on('broadcast', { event: 'new_item' }, (res: any) => {
          const item = res.payload?.item;
          if (item) {
            setItems((prev) => (prev.some((i) => i.id === item.id) ? prev : [item, ...prev]));
            setRoom((prev) => (prev ? { ...prev, itemCount: prev.itemCount + 1 } : prev));
          }
        })
        .on('broadcast', { event: 'item_updated' }, (res: any) => {
          const item = res.payload?.item;
          if (item) {
            setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, ...item } : i)));
          }
        })
        .on('broadcast', { event: 'item_deleted' }, (res: any) => {
          const itemId = res.payload?.itemId;
          if (itemId) {
            setItems((prev) => prev.filter((i) => i.id !== itemId));
            setRoom((prev) => (prev ? { ...prev, itemCount: Math.max(0, prev.itemCount - 1) } : prev));
          }
        })
        .on('broadcast', { event: 'items_cleared' }, () => {
          setItems([]);
          setRoom((prev) => (prev ? { ...prev, itemCount: 0 } : prev));
        })
        .on('broadcast', { event: 'room_deleted' }, () => {
          setRoom(null);
          setItems([]);
          setPeers([]);
          localStorage.removeItem(STORAGE_ACTIVE_ROOM_KEY);
          setError('This room was deleted permanently.');
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
        supabaseChannelRef.current = null;
      };
    } catch (err) {
      console.error('Error subscribing to Supabase Realtime channel:', err);
    }
  }, [room?.id, networkInfo?.supabase]);

  // WebSocket Connection (handles presence & broadcast fallback)
  const connectWebSocket = useCallback((roomId: string) => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnecting(true);
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      setIsConnecting(false);
      setError(null);

      const joinMsg = {
        type: 'join',
        roomId,
        role: roleRef.current,
        deviceName: detectDeviceName(roleRef.current),
      };
      ws.send(JSON.stringify(joinMsg));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as WSServerMessage;

        if (msg.type === 'joined') {
          setRoom(msg.room);
          setPeers(msg.room.peers || []);
          setItems(msg.room.items || []);
        } else if (msg.type === 'peer_joined') {
          setPeers((prev) => {
            if (prev.some((p) => p.id === msg.peer.id)) return prev;
            return [...prev, msg.peer];
          });
        } else if (msg.type === 'peer_left') {
          setPeers((prev) => prev.filter((p) => p.id !== msg.peerId));
        } else if (msg.type === 'new_item') {
          setItems((prev) => {
            if (prev.some((i) => i.id === msg.item.id)) return prev;
            return [msg.item, ...prev];
          });
          setRoom((prev) => (prev ? { ...prev, itemCount: prev.itemCount + 1 } : prev));
        } else if (msg.type === 'item_updated') {
          setItems((prev) =>
            prev.map((i) => (i.id === msg.item.id ? { ...i, ...msg.item } : i))
          );
        } else if (msg.type === 'item_deleted') {
          setItems((prev) => prev.filter((i) => i.id !== msg.itemId));
          setRoom((prev) => (prev ? { ...prev, itemCount: Math.max(0, prev.itemCount - 1) } : prev));
        } else if (msg.type === 'items_cleared') {
          setItems([]);
          setRoom((prev) => (prev ? { ...prev, itemCount: 0 } : prev));
        } else if (msg.type === 'room_deleted') {
          setRoom(null);
          setItems([]);
          setPeers([]);
          localStorage.removeItem(STORAGE_ACTIVE_ROOM_KEY);
          setError('This room was deleted permanently.');
        } else if (msg.type === 'error') {
          setError(msg.message);
        }
      } catch (err) {
        console.error('Error handling WS message:', err);
      }
    };

    ws.onerror = () => {
      setIsConnecting(false);
    };

    ws.onclose = () => {
      setIsConnected(false);
      setIsConnecting(false);
    };
  }, []);

  // Create Room
  const createRoom = useCallback(
    async (customCode?: string, name?: string) => {
      try {
        setIsConnecting(true);
        setError(null);
        const res = await fetch('/api/rooms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ customCode, name }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Failed to create room');
        }

        const data: RoomMetadata = await res.json();
        activeRoomIdRef.current = data.id;
        localStorage.setItem(STORAGE_ACTIVE_ROOM_KEY, data.code);
        setRoom(data);
        setItems([]);
        setPeers([]);
        connectWebSocket(data.id);
        return data;
      } catch (err: any) {
        setError(err.message || 'Error creating room');
        setIsConnecting(false);
        return null;
      }
    },
    [connectWebSocket]
  );

  // Join Room
  const joinRoom = useCallback(
    async (idOrCode: string) => {
      try {
        setIsConnecting(true);
        setError(null);
        const res = await fetch(`/api/rooms/${encodeURIComponent(idOrCode.trim())}`);
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Room not found. Please verify the code.');
        }

        const data: RoomMetadata = await res.json();
        activeRoomIdRef.current = data.id;
        localStorage.setItem(STORAGE_ACTIVE_ROOM_KEY, data.code);
        setRoom(data);
        setItems(data.items || []);
        setPeers(data.peers || []);
        connectWebSocket(data.id);
        return data;
      } catch (err: any) {
        setError(err.message || 'Unable to join room');
        setIsConnecting(false);
        return null;
      }
    },
    [connectWebSocket]
  );

  // Leave active room
  const leaveRoom = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setRoom(null);
    setItems([]);
    setPeers([]);
    activeRoomIdRef.current = null;
    localStorage.removeItem(STORAGE_ACTIVE_ROOM_KEY);
  }, []);

  // Send Code or Text snippet
  const sendSnippet = useCallback(
    async (content: string, title?: string, language?: string) => {
      if (!room) return false;
      try {
        const deviceName = detectDeviceName(roleRef.current);
        const res = await fetch(`/api/rooms/${room.id}/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'code',
            content,
            title,
            language,
            senderDevice: deviceName,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Failed to send snippet');
        }

        return true;
      } catch (err: any) {
        setError(err.message || 'Failed to send snippet');
        return false;
      }
    },
    [room]
  );

  // Upload one or multiple files
  const uploadFiles = useCallback(
    async (files: File[] | FileList, onProgress?: (percent: number) => void): Promise<boolean> => {
      if (!room) return false;
      const fileArray = Array.from(files);
      if (fileArray.length === 0) return false;

      for (const file of fileArray) {
        if (file.size > 50 * 1024 * 1024) {
          setError(`File "${file.name}" exceeds the 50MB limit.`);
          return false;
        }
      }

      return new Promise((resolve) => {
        const formData = new FormData();
        fileArray.forEach((file) => formData.append('files', file));
        formData.append('senderDevice', detectDeviceName(roleRef.current));

        const xhr = new XMLHttpRequest();
        xhr.open('POST', `/api/rooms/${room.id}/files`);

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 100);
            setUploadProgress(percent);
            onProgress?.(percent);
          }
        };

        xhr.onload = () => {
          setUploadProgress(null);
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(true);
          } else {
            try {
              const err = JSON.parse(xhr.responseText);
              setError(err.error || 'File upload failed');
            } catch {
              setError('File upload failed');
            }
            resolve(false);
          }
        };

        xhr.onerror = () => {
          setUploadProgress(null);
          setError('Network error during file upload');
          resolve(false);
        };

        xhr.send(formData);
      });
    },
    [room]
  );

  // Rename an item (Title or Filename)
  const renameItem = useCallback(
    async (itemId: string, newTitle: string) => {
      if (!room) return false;
      try {
        const res = await fetch(`/api/rooms/${room.id}/items/${itemId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: newTitle }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Failed to rename item');
        }

        return true;
      } catch (err: any) {
        setError(err.message || 'Failed to rename item');
        return false;
      }
    },
    [room]
  );

  // Delete an individual item
  const deleteItem = useCallback(
    async (itemId: string) => {
      if (!room) return false;
      try {
        const res = await fetch(`/api/rooms/${room.id}/items/${itemId}`, {
          method: 'DELETE',
        });
        if (!res.ok) {
          throw new Error('Failed to delete item');
        }
        return true;
      } catch (err: any) {
        setError(err.message || 'Failed to delete item');
        return false;
      }
    },
    [room]
  );

  // Clear all items in room
  const clearAllItems = useCallback(async () => {
    if (!room) return false;
    try {
      const res = await fetch(`/api/rooms/${room.id}/items`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        throw new Error('Failed to clear items');
      }
      return true;
    } catch (err: any) {
      setError(err.message || 'Failed to clear items');
      return false;
    }
  }, [room]);

  // Delete entire room
  const deleteRoom = useCallback(async () => {
    if (!room) return false;
    try {
      const res = await fetch(`/api/rooms/${room.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setRoom(null);
        setItems([]);
        setPeers([]);
        localStorage.removeItem(STORAGE_ACTIVE_ROOM_KEY);
        setError('Room and all associated files deleted permanently.');
        return true;
      }
      return false;
    } catch (err: any) {
      setError(err.message || 'Failed to delete room');
      return false;
    }
  }, [room]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  return {
    room,
    items,
    peers,
    isConnected,
    isConnecting,
    error,
    setError,
    uploadProgress,
    networkInfo,
    createRoom,
    joinRoom,
    leaveRoom,
    sendSnippet,
    uploadFiles,
    renameItem,
    deleteItem,
    clearAllItems,
    deleteRoom,
  };
}
