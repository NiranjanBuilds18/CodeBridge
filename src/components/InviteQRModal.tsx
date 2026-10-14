import React, { useState, useEffect, useMemo } from 'react';
import { Copy, Check, X, Wifi, ShieldCheck, Share2 } from 'lucide-react';
import { generateQrDataUrl } from '../utils/qr.js';
import { copyToClipboard } from '../utils/device.js';
import type { RoomMetadata, NetworkInfo } from '../types.js';

interface InviteQRModalProps {
  isOpen: boolean;
  onClose: () => void;
  room: RoomMetadata;
  networkInfo: NetworkInfo | null;
}

export const InviteQRModal: React.FC<InviteQRModalProps> = ({
  isOpen,
  onClose,
  room,
  networkInfo,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [selectedBaseUrl, setSelectedBaseUrl] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const availableUrls = useMemo(() => {
    const urls: Array<{ label: string; url: string; isLan?: boolean }> = [];
    const origin = window.location.origin;

    urls.push({ label: 'Current Origin', url: origin });

    if (networkInfo?.suggestedUrl && networkInfo.suggestedUrl !== origin) {
      urls.unshift({ label: 'Public HTTPS URL', url: networkInfo.suggestedUrl });
    }

    if (networkInfo?.lanIps && networkInfo.lanIps.length > 0) {
      for (const ip of networkInfo.lanIps) {
        const lanUrl = `http://${ip}:${networkInfo.port || 3000}`;
        urls.push({ label: `Wi-Fi LAN (${ip})`, url: lanUrl, isLan: true });
      }
    }

    return urls;
  }, [networkInfo]);

  useEffect(() => {
    if (availableUrls.length > 0 && !selectedBaseUrl) {
      setSelectedBaseUrl(availableUrls[0].url);
    }
  }, [availableUrls, selectedBaseUrl]);

  const directJoinUrl = useMemo(() => {
    const base = selectedBaseUrl || window.location.origin;
    return `${base}?room=${encodeURIComponent(room.code)}`;
  }, [selectedBaseUrl, room.code]);

  useEffect(() => {
    if (!directJoinUrl) return;
    let isCurrent = true;
    generateQrDataUrl(directJoinUrl).then((url) => {
      if (isCurrent) setQrDataUrl(url);
    });
    return () => {
      isCurrent = false;
    };
  }, [directJoinUrl]);

  if (!isOpen) return null;

  const handleCopyLink = async () => {
    const ok = await copyToClipboard(directJoinUrl);
    if (ok) {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 1800);
    }
  };

  const handleCopyCode = async () => {
    const ok = await copyToClipboard(room.code);
    if (ok) {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 1800);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-2xs animate-in fade-in duration-100">
      <div className="bg-white dark:bg-[#18191A] border border-[#E6E6E1] dark:border-[#2B2C2E] rounded-lg max-w-sm w-full p-5 shadow-lg relative text-xs">
        <button
          onClick={onClose}
          className="absolute top-3.5 right-3.5 text-[#7E8079] hover:text-[#111213] dark:hover:text-[#EDEDEA] p-1 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 mb-3">
          <Share2 className="w-4 h-4 text-[#1E4D36] dark:text-[#3B8563]" />
          <h3 className="text-xs font-semibold text-[#111213] dark:text-[#EDEDEA]">
            Pair Device with QR or Code
          </h3>
        </div>

        {/* High Contrast QR Code */}
        <div className="flex flex-col items-center justify-center my-2">
          <div className="p-2.5 bg-[#FAFAF7] dark:bg-[#121314] border border-[#E6E6E1] dark:border-[#2B2C2E] rounded">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt={`Room QR Code: ${room.code}`}
                className="w-44 h-44 rounded block"
              />
            ) : (
              <div className="w-44 h-44 flex items-center justify-center text-[11px] text-[#7E8079]">
                Generating QR...
              </div>
            )}
          </div>
          <p className="text-[11px] text-[#7E8079] mt-2 text-center">
            Scan with phone camera to connect instantly
          </p>
        </div>

        {/* Room Code Card */}
        <div className="p-2.5 bg-[#FAFAF7] dark:bg-[#212224] border border-[#E6E6E1] dark:border-[#2B2C2E] rounded mb-2.5">
          <div className="flex items-center justify-between text-[11px] text-[#7E8079] mb-1">
            <span>Room Code:</span>
            <span className="font-mono">Case-insensitive</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-mono text-sm font-bold text-[#111213] dark:text-[#EDEDEA] tracking-wider">
              {room.code}
            </span>
            <button
              onClick={handleCopyCode}
              className="px-2 py-0.5 text-xs font-medium text-[#1E4D36] dark:text-[#3B8563] bg-white dark:bg-[#18191A] border border-[#E6E6E1] dark:border-[#2B2C2E] rounded hover:bg-[#F3F3EE] transition-colors flex items-center gap-1"
            >
              {copiedCode ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              <span>{copiedCode ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>

        {/* Copy Direct URL */}
        <button
          onClick={handleCopyLink}
          className="w-full py-1.5 px-3 text-xs font-medium text-[#111213] dark:text-[#EDEDEA] bg-[#FAFAF7] dark:bg-[#212224] hover:bg-[#F3F3EE] dark:hover:bg-[#2B2C2F] border border-[#E6E6E1] dark:border-[#2B2C2E] rounded transition-colors flex items-center justify-center gap-1.5 mb-2.5"
        >
          {copiedLink ? <Check className="w-3.5 h-3.5 text-[#1E4D36]" /> : <Copy className="w-3.5 h-3.5 text-[#7E8079]" />}
          <span>{copiedLink ? 'Link Copied to Clipboard!' : 'Copy Direct Link'}</span>
        </button>

        {/* Wi-Fi LAN selector if multiple addresses detected */}
        {availableUrls.length > 1 && (
          <div className="pt-2 border-t border-[#E6E6E1] dark:border-[#2B2C2E] text-[11px]">
            <div className="flex items-center justify-between text-[#7E8079] mb-1">
              <span className="flex items-center gap-1">
                <Wifi className="w-3 h-3 text-[#1E4D36]" />
                Target Network
              </span>
              <span>LAN Option</span>
            </div>
            <select
              value={selectedBaseUrl}
              onChange={(e) => setSelectedBaseUrl(e.target.value)}
              className="w-full bg-[#FAFAF7] dark:bg-[#121314] border border-[#E6E6E1] dark:border-[#2B2C2E] rounded px-2 py-1 text-[11px] text-[#111213] dark:text-[#EDEDEA] focus:outline-hidden"
            >
              {availableUrls.map((u, i) => (
                <option key={i} value={u.url}>
                  {u.label} ({u.url})
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="mt-3 pt-2.5 border-t border-[#E6E6E1] dark:border-[#2B2C2E] flex items-center gap-1.5 text-[10px] text-[#7E8079]">
          <ShieldCheck className="w-3 h-3 text-[#1E4D36] shrink-0" />
          <span>Persistent storage on server disk. Reconnect anytime.</span>
        </div>
      </div>
    </div>
  );
};
