import React, { useState } from 'react';
import {
  ShieldCheck,
  HardDrive,
  Lock,
  FileCode,
  Trash2,
  X,
  Database,
  Radio,
  Copy,
  Check,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import type { SupabasePublicConfig } from '../types.js';
import { copyToClipboard } from '../utils/device.js';

interface SecurityInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  supabaseConfig?: SupabasePublicConfig;
}

export const SecurityInfoModal: React.FC<SecurityInfoModalProps> = ({
  isOpen,
  onClose,
  supabaseConfig,
}) => {
  const [activeTab, setActiveTab] = useState<'architecture' | 'setup'>('architecture');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = async (key: string, text: string) => {
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1800);
    }
  };

  const isConfigured = supabaseConfig?.isConfigured;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-2xs animate-in fade-in duration-100">
      <div className="bg-white dark:bg-[#18191A] border border-[#E6E6E1] dark:border-[#2B2C2E] rounded-lg max-w-lg w-full p-5 shadow-lg relative text-xs">
        <button
          onClick={onClose}
          className="absolute top-3.5 right-3.5 text-[#7E8079] hover:text-[#111213] dark:hover:text-[#EDEDEA] p-1 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <div className="w-5 h-5 rounded bg-[#1E4D36]/10 dark:bg-[#3B8563]/20 flex items-center justify-center text-[#1E4D36] dark:text-[#3B8563]">
            <ShieldCheck className="w-3.5 h-3.5" />
          </div>
          <h3 className="text-xs font-semibold text-[#111213] dark:text-[#EDEDEA]">
            Security & Supabase Architecture
          </h3>
          <span
            className={`ml-auto mr-6 text-[10px] px-2 py-0.5 rounded font-mono font-medium ${
              isConfigured
                ? 'bg-[#1E4D36]/10 text-[#1E4D36] dark:bg-[#3B8563]/20 dark:text-[#3B8563]'
                : 'bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-400'
            }`}
          >
            {isConfigured ? 'Supabase Active' : 'Disk Storage Fallback'}
          </span>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-[#E6E6E1] dark:border-[#2B2C2E] mb-3">
          <button
            onClick={() => setActiveTab('architecture')}
            className={`pb-2 px-1 text-xs font-medium border-b-2 transition-colors mr-4 ${
              activeTab === 'architecture'
                ? 'border-[#1E4D36] dark:border-[#3B8563] text-[#111213] dark:text-[#EDEDEA]'
                : 'border-transparent text-[#7E8079] hover:text-[#111213] dark:hover:text-[#EDEDEA]'
            }`}
          >
            Architecture & RLS
          </button>
          <button
            onClick={() => setActiveTab('setup')}
            className={`pb-2 px-1 text-xs font-medium border-b-2 transition-colors ${
              activeTab === 'setup'
                ? 'border-[#1E4D36] dark:border-[#3B8563] text-[#111213] dark:text-[#EDEDEA]'
                : 'border-transparent text-[#7E8079] hover:text-[#111213] dark:hover:text-[#EDEDEA]'
            }`}
          >
            Supabase Free Plan Setup
          </button>
        </div>

        {activeTab === 'architecture' ? (
          <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1 text-[#52534F] dark:text-[#B1B2AC] leading-relaxed">
            <div className="p-2.5 bg-[#FAFAF7] dark:bg-[#212224] border border-[#E6E6E1] dark:border-[#2B2C2E] rounded space-y-1">
              <div className="flex items-center gap-1.5 text-[#111213] dark:text-[#EDEDEA] font-semibold">
                <Database className="w-3.5 h-3.5 text-[#1E4D36] dark:text-[#3B8563]" />
                <span>PostgreSQL Persistent Rooms (No Expiry)</span>
              </div>
              <p className="text-[11px]">
                Rooms and file metadata are saved in PostgreSQL tables (<code className="px-1 py-0.2 bg-black/5 dark:bg-white/10 rounded font-mono">rooms</code> and <code className="px-1 py-0.2 bg-black/5 dark:bg-white/10 rounded font-mono">room_items</code>). Rooms have no timeout or automatic expiration — they remain accessible until manually deleted.
              </p>
            </div>

            <div className="p-2.5 bg-[#FAFAF7] dark:bg-[#212224] border border-[#E6E6E1] dark:border-[#2B2C2E] rounded space-y-1">
              <div className="flex items-center gap-1.5 text-[#111213] dark:text-[#EDEDEA] font-semibold">
                <HardDrive className="w-3.5 h-3.5 text-[#1E4D36] dark:text-[#3B8563]" />
                <span>Supabase Storage (Direct Binary Files)</span>
              </div>
              <p className="text-[11px]">
                Files are uploaded to the <code className="px-1 py-0.2 bg-black/5 dark:bg-white/10 rounded font-mono">codebridge-files</code> bucket as raw binaries without base64 overhead. File sizes up to 50MB are supported on the Free tier.
              </p>
            </div>

            <div className="p-2.5 bg-[#FAFAF7] dark:bg-[#212224] border border-[#E6E6E1] dark:border-[#2B2C2E] rounded space-y-1">
              <div className="flex items-center gap-1.5 text-[#111213] dark:text-[#EDEDEA] font-semibold">
                <Radio className="w-3.5 h-3.5 text-[#1E4D36] dark:text-[#3B8563]" />
                <span>Supabase Realtime Synchronization</span>
              </div>
              <p className="text-[11px]">
                Connected browsers subscribe to Supabase Realtime channels (<code className="px-1 py-0.2 bg-black/5 dark:bg-white/10 rounded font-mono">room:&#123;id&#125;</code>) using the public anonymous key. Real-time updates sync instantly between phone and laptop.
              </p>
            </div>

            <div className="p-2.5 bg-[#FAFAF7] dark:bg-[#212224] border border-[#E6E6E1] dark:border-[#2B2C2E] rounded space-y-1">
              <div className="flex items-center gap-1.5 text-[#111213] dark:text-[#EDEDEA] font-semibold">
                <Lock className="w-3.5 h-3.5 text-[#1E4D36] dark:text-[#3B8563]" />
                <span>Row Level Security (RLS) & Key Isolation</span>
              </div>
              <p className="text-[11px]">
                The secret <code className="px-1 py-0.2 bg-black/5 dark:bg-white/10 rounded font-mono">SERVICE_ROLE_KEY</code> is kept strictly on the server for write authorization and rate limiting. Only the safe public anon key is delivered to client browsers.
              </p>
            </div>

            <div className="p-2.5 bg-[#FAFAF7] dark:bg-[#212224] border border-[#E6E6E1] dark:border-[#2B2C2E] rounded space-y-1">
              <div className="flex items-center gap-1.5 text-[#111213] dark:text-[#EDEDEA] font-semibold">
                <Trash2 className="w-3.5 h-3.5 text-[#1E4D36] dark:text-[#3B8563]" />
                <span>Immediate Permanent Deletion</span>
              </div>
              <p className="text-[11px]">
                When an item or room is deleted, files in Supabase Storage and database rows are purged immediately with cascading foreign keys.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1 text-[#52534F] dark:text-[#B1B2AC] leading-relaxed">
            <p className="text-[11px]">
              CodeBridge works automatically out-of-the-box with local disk storage, and can be connected to any free Supabase project in 2 minutes:
            </p>

            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-[#1E4D36] text-white flex items-center justify-center text-[10px] shrink-0 mt-0.5">1</span>
                <div>
                  <p className="font-semibold text-[#111213] dark:text-[#EDEDEA]">Create a Free Project</p>
                  <p className="text-[11px]">Sign in at <a href="https://supabase.com" target="_blank" rel="noreferrer" className="text-[#1E4D36] dark:text-[#3B8563] underline inline-flex items-center gap-0.5">supabase.com <ExternalLink className="w-2.5 h-2.5" /></a> and create a new project.</p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-[#1E4D36] text-white flex items-center justify-center text-[10px] shrink-0 mt-0.5">2</span>
                <div>
                  <p className="font-semibold text-[#111213] dark:text-[#EDEDEA]">Run SQL Migration</p>
                  <p className="text-[11px]">Copy the migration script from <code className="px-1 py-0.2 bg-black/5 dark:bg-white/10 rounded font-mono">/supabase/migrations/20261014000000_create_codebridge_schema.sql</code> and execute it in Supabase SQL Editor.</p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-[#1E4D36] text-white flex items-center justify-center text-[10px] shrink-0 mt-0.5">3</span>
                <div>
                  <p className="font-semibold text-[#111213] dark:text-[#EDEDEA]">Configure Environment Variables</p>
                  <p className="text-[11px]">Add these variables to your environment (use root Project URL; do not append <code className="px-1 py-0.2 bg-black/5 dark:bg-white/10 rounded font-mono">/rest/v1</code>):</p>
                </div>
              </div>
            </div>

            <div className="p-2.5 bg-[#FAFAF7] dark:bg-[#212224] border border-[#E6E6E1] dark:border-[#2B2C2E] rounded font-mono text-[10px] space-y-1.5 text-[#111213] dark:text-[#EDEDEA]">
              <div className="flex items-center justify-between">
                <span>SUPABASE_URL="https://xyz.supabase.co"</span>
                <button
                  onClick={() => handleCopy('url', 'SUPABASE_URL="https://xyz.supabase.co"')}
                  className="p-1 text-[#7E8079] hover:text-[#111213] dark:hover:text-[#EDEDEA]"
                >
                  {copiedKey === 'url' ? <Check className="w-3 h-3 text-[#1E4D36]" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
              <div className="flex items-center justify-between">
                <span>SUPABASE_ANON_KEY="..."</span>
                <button
                  onClick={() => handleCopy('anon', 'SUPABASE_ANON_KEY=""')}
                  className="p-1 text-[#7E8079] hover:text-[#111213] dark:hover:text-[#EDEDEA]"
                >
                  {copiedKey === 'anon' ? <Check className="w-3 h-3 text-[#1E4D36]" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
              <div className="flex items-center justify-between">
                <span>SUPABASE_SERVICE_ROLE_KEY="..."</span>
                <button
                  onClick={() => handleCopy('service', 'SUPABASE_SERVICE_ROLE_KEY=""')}
                  className="p-1 text-[#7E8079] hover:text-[#111213] dark:hover:text-[#EDEDEA]"
                >
                  {copiedKey === 'service' ? <Check className="w-3 h-3 text-[#1E4D36]" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="mt-4 pt-2.5 border-t border-[#E6E6E1] dark:border-[#2B2C2E] flex justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1 text-xs font-medium text-[#111213] dark:text-[#EDEDEA] bg-[#FAFAF7] dark:bg-[#212224] hover:bg-[#F3F3EE] dark:hover:bg-[#2B2C2F] border border-[#E6E6E1] dark:border-[#2B2C2E] rounded transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
