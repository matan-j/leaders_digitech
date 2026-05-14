import { useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface MessageAttachment {
  name: string;
  url: string;
  mime_type: string | null;
  size: number | null;
  kind: 'image' | 'video' | 'audio' | 'document';
  storage_path: string | null;
}

interface MessageAttachmentInputProps {
  value: MessageAttachment[];
  onChange: (next: MessageAttachment[]) => void;
  // Storage path scope. For institution-scoped sends use the institution id; for
  // templates (and any other non-institution context) use 'templates' or similar.
  scopeId: string;
  maxFiles?: number;
  maxFileSizeMB?: number;
  // Optional override of the bucket folder prefix. Defaults to 'crm-attachments'.
  folder?: string;
}

const DEFAULT_MAX_FILES = 6;
const DEFAULT_MAX_SIZE_MB = 100;

const C = {
  text: '#111827', textSub: '#6B7280', textDim: '#9CA3AF',
  border: '#E4E7ED', borderLight: '#F0F2F5',
  bg: '#F8F9FB', surface: '#FFFFFF',
  accent: '#3B5BDB', accentBg: '#EEF2FF',
  success: '#16A34A', successBg: '#DCFCE7',
  danger: '#DC2626', dangerBg: '#FEE2E2',
  warning: '#D97706', warningBg: '#FEF3C7',
};

function detectKind(mime: string, name: string): MessageAttachment['kind'] {
  const lowerName = name.toLowerCase();
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (lowerName.endsWith('.mp3') || lowerName.endsWith('.wav') || lowerName.endsWith('.ogg') || lowerName.endsWith('.m4a')) return 'audio';
  if (lowerName.endsWith('.mp4') || lowerName.endsWith('.mov') || lowerName.endsWith('.webm')) return 'video';
  if (lowerName.match(/\.(jpe?g|png|gif|webp|bmp|svg)$/)) return 'image';
  return 'document';
}

function iconForKind(kind: MessageAttachment['kind']): string {
  switch (kind) {
    case 'image': return '🖼️';
    case 'video': return '🎬';
    case 'audio': return '🎵';
    default: return '📄';
  }
}

function fmtSize(bytes: number | null): string {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function MessageAttachmentInput({
  value,
  onChange,
  scopeId,
  maxFiles = DEFAULT_MAX_FILES,
  maxFileSizeMB = DEFAULT_MAX_SIZE_MB,
  folder = 'crm-attachments',
}: MessageAttachmentInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<string>('');
  const [error, setError] = useState<string>('');

  const handlePick = () => inputRef.current?.click();

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setError('');

    const remaining = maxFiles - value.length;
    if (remaining <= 0) {
      setError(`ניתן לצרף עד ${maxFiles} קבצים`);
      if (inputRef.current) inputRef.current.value = '';
      return;
    }
    const toUpload = files.slice(0, remaining);
    if (files.length > remaining) {
      setError(`נבחרו יותר מ-${maxFiles} — מועלים רק ${remaining} הראשונים`);
    }

    const limitBytes = maxFileSizeMB * 1024 * 1024;
    setUploading(true);
    try {
      const uploaded: MessageAttachment[] = [];
      for (let i = 0; i < toUpload.length; i++) {
        const file = toUpload[i];
        if (file.size > limitBytes) {
          setError(`הקובץ "${file.name}" חורג מ-${maxFileSizeMB}MB ולא הועלה`);
          continue;
        }
        setProgress(`מעלה ${i + 1}/${toUpload.length}: ${file.name}`);
        const safeName = file.name.replace(/[^\w.\-]/g, '_');
        const storagePath = `${folder}/${scopeId}/${Date.now()}_${i}_${safeName}`;
        const { error: upErr } = await supabase.storage
          .from('lesson-files')
          .upload(storagePath, file, { contentType: file.type || undefined, upsert: false });
        if (upErr) {
          setError(`שגיאה בהעלאת "${file.name}": ${upErr.message}`);
          continue;
        }
        const { data: pub } = supabase.storage.from('lesson-files').getPublicUrl(storagePath);
        uploaded.push({
          name: file.name,
          url: pub.publicUrl,
          mime_type: file.type || null,
          size: file.size,
          kind: detectKind(file.type || '', file.name),
          storage_path: storagePath,
        });
      }
      if (uploaded.length > 0) onChange([...value, ...uploaded]);
    } finally {
      setUploading(false);
      setProgress('');
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const removeAt = async (index: number) => {
    const target = value[index];
    if (!target) return;
    const next = value.filter((_, i) => i !== index);
    onChange(next);
    // Best-effort delete from storage (don't block UI on failure)
    if (target.storage_path) {
      supabase.storage.from('lesson-files').remove([target.storage_path]).catch(() => {});
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <input
        ref={inputRef}
        type="file"
        multiple
        style={{ display: 'none' }}
        onChange={handleFiles}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={handlePick}
          disabled={uploading || value.length >= maxFiles}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
            background: C.accentBg, color: C.accent, border: `1px solid ${C.accent}30`,
            cursor: uploading || value.length >= maxFiles ? 'not-allowed' : 'pointer',
            opacity: uploading || value.length >= maxFiles ? 0.6 : 1,
          }}
        >
          📎 {uploading ? 'מעלה...' : 'צרף קבצים'}
        </button>
        <span style={{ fontSize: 11, color: C.textDim }}>
          עד {maxFiles} קבצים · {maxFileSizeMB}MB לקובץ
        </span>
      </div>
      {progress && (
        <div style={{ fontSize: 11, color: C.textSub }}>{progress}</div>
      )}
      {error && (
        <div style={{ fontSize: 11, color: C.danger, background: C.dangerBg, padding: '4px 8px', borderRadius: 6 }}>
          ⚠️ {error}
        </div>
      )}
      {value.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
          {value.map((att, i) => (
            <div
              key={`${att.storage_path ?? att.url}_${i}`}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 10px', borderRadius: 8,
                background: C.surface, border: `1px solid ${C.border}`,
              }}
            >
              <span style={{ fontSize: 16 }}>{iconForKind(att.kind)}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: C.text, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {att.name}
                </div>
                <div style={{ fontSize: 10, color: C.textDim }}>{fmtSize(att.size)}</div>
              </div>
              <a
                href={att.url}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: 11, color: C.accent, textDecoration: 'none' }}
              >
                תצוגה
              </a>
              <button
                type="button"
                onClick={() => removeAt(i)}
                disabled={uploading}
                style={{
                  background: C.dangerBg, color: C.danger, border: 'none',
                  borderRadius: 6, padding: '4px 8px', fontSize: 11, fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                הסר
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
