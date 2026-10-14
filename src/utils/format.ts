export function formatBytes(bytes?: number): string {
  if (bytes === undefined || bytes === null || isNaN(bytes)) return '0 B';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return '00:00';
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export function formatRelativeTime(timestamp: number): string {
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 5) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  return `${diffHours}h ago`;
}

export function detectLanguage(code: string): string {
  const trimmed = code.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      JSON.parse(trimmed);
      return 'JSON';
    } catch {
      // not strict JSON
    }
  }

  if (/^<(!DOCTYPE|html|div|svg|head|body|script)/i.test(trimmed)) {
    return 'HTML/XML';
  }

  if (/^(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\s/i.test(trimmed)) {
    return 'SQL';
  }

  if (/^(def\s+|import\s+[\w.]+|from\s+[\w.]+\s+import|class\s+\w+:)/m.test(trimmed)) {
    return 'Python';
  }

  if (/(interface\s+\w+|type\s+\w+\s*=|import\s+type|:\s*(string|number|boolean|any))/m.test(trimmed)) {
    return 'TypeScript';
  }

  if (/(const\s+\w+\s*=|let\s+\w+\s*=|function\s+\w+|=>\s*\{|console\.log)/m.test(trimmed)) {
    return 'JavaScript';
  }

  if (/(#include\s+<|int\s+main\s*\(|std::)/m.test(trimmed)) {
    return 'C/C++';
  }

  if (/(fn\s+main|pub\s+fn|let\s+mut|impl\s+)/m.test(trimmed)) {
    return 'Rust';
  }

  if (/(\$|\b)(curl|wget|grep|chmod|npm|git|docker|cat|echo)\b/m.test(trimmed)) {
    return 'Shell/Bash';
  }

  if (/(^#\s|\*\*.*?\*\*|\[.*?\]\(.*?\))/m.test(trimmed)) {
    return 'Markdown';
  }

  return 'Plain Text';
}

export function getFileCategory(filename?: string, mimeType?: string): {
  iconType: 'code' | 'image' | 'archive' | 'pdf' | 'text' | 'generic';
  label: string;
} {
  const lower = (filename || '').toLowerCase();
  const ext = lower.split('.').pop() || '';

  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif'].includes(ext) || (mimeType && mimeType.startsWith('image/'))) {
    return { iconType: 'image', label: ext.toUpperCase() || 'IMAGE' };
  }

  if (['zip', 'tar', 'gz', 'rar', '7z'].includes(ext)) {
    return { iconType: 'archive', label: 'ARCHIVE' };
  }

  if (ext === 'pdf') {
    return { iconType: 'pdf', label: 'PDF' };
  }

  if (['ts', 'tsx', 'js', 'jsx', 'py', 'json', 'html', 'css', 'go', 'rs', 'c', 'cpp', 'java', 'sql', 'sh', 'yaml', 'yml'].includes(ext)) {
    return { iconType: 'code', label: ext.toUpperCase() };
  }

  if (['txt', 'md', 'log', 'csv'].includes(ext)) {
    return { iconType: 'text', label: ext.toUpperCase() };
  }

  return { iconType: 'generic', label: ext.toUpperCase() || 'FILE' };
}
