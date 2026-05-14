'use client';

import { useState, useRef } from 'react';
import { X, Upload, CheckCircle, AlertCircle, FileJson, Loader2 } from 'lucide-react';
import { type ImportResult, type ImportProgress, type TrelloExport } from '@/lib/trello-import';
import { useBoardStore } from '@/store/boardStore';
import { supabase } from '@/lib/supabase';

export default function TrelloImport({ onClose }: { onClose: () => void }) {
  const { loadBoard } = useBoardStore();
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [preview, setPreview] = useState<{ lists: number; cards: number; archived: number; labels: number; checklists: number; actions: number; attachments: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<TrelloExport | null>(null);

  const handleFile = async (f: File) => {
    setFile(f);
    setError(null);
    setResult(null);
    setPreview(null);
    setParsing(true);
    try {
      const text = await f.text();
      const json = JSON.parse(text) as TrelloExport;
      if (!json.lists || !json.cards) {
        throw new Error('ไฟล์นี้ไม่ใช่ Trello export JSON (ไม่มี lists/cards)');
      }
      setParsed(json);
      setPreview({
        lists: json.lists.filter((l) => !l.closed).length,
        cards: json.cards.length,
        archived: json.cards.filter((c) => c.closed).length,
        labels: json.labels?.length || 0,
        checklists: json.checklists?.length || 0,
        actions: json.actions?.filter((a) => a.type === 'commentCard').length || 0,
        attachments: json.cards.reduce((s, c) => s + (c.attachments?.length || 0), 0),
      });
    } catch (e: any) {
      setError(e.message || 'ไฟล์ไม่ถูกต้อง');
    } finally {
      setParsing(false);
    }
  };

  const handleImport = async () => {
    if (!parsed) return;
    setImporting(true);
    setError(null);
    setProgress({ step: 'uploading' });
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('ต้อง login ก่อน');

      setProgress({ step: 'processing' });
      // Send JSON to server-side endpoint — avoids browser/extension fetch blocking
      const res = await fetch('/api/import/trello', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ json: parsed }),
      });
      const body = await res.json();
      if (!res.ok || !body.ok) {
        throw new Error(body.error || `Import failed (${res.status})`);
      }
      setResult(body.result);
      await loadBoard();
    } catch (e: any) {
      setError(e.message || 'Import error');
    } finally {
      setImporting(false);
      setProgress(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-4 px-3 overflow-y-auto">
      <div className="fixed inset-0 bg-black/60 animate-backdrop-in" onClick={onClose} />
      <div className="relative bg-[#1d2125] rounded-2xl w-full max-w-lg shadow-2xl animate-modal-in border border-white/10 my-4">
        {/* Header — sticky at top so always visible */}
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b border-white/10 bg-[#1d2125] rounded-t-2xl">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <FileJson size={18} className="text-white" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Import จาก Trello</h2>
              <p className="text-xs text-gray-400">นำเข้างานทั้งหมดจาก Trello board</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4">
          {!result && (
            <>
              <input
                ref={fileRef}
                type="file"
                accept=".json,application/json"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                className="hidden"
              />

              {/* Instructions — show only before file is loaded */}
              {!preview && (
                <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3 mb-3">
                  <p className="text-sm text-blue-200 font-medium mb-1">📤 วิธี export จาก Trello</p>
                  <ol className="text-xs text-blue-100/80 space-y-1 list-decimal pl-4">
                    <li>Trello board → "Show menu" → "..." → "Print, export, and share"</li>
                    <li>กด "Export as JSON" → Save ไฟล์ .json</li>
                  </ol>
                </div>
              )}

              {/* File drop zone — compact when file loaded */}
              {!preview ? (
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={parsing || importing}
                  className="w-full border-2 border-dashed border-white/15 hover:border-blue-500/50 hover:bg-blue-500/5 rounded-xl p-5 text-center transition-all disabled:opacity-50"
                >
                  <Upload size={24} className="mx-auto text-gray-400 mb-1.5" />
                  <p className="text-sm text-gray-300 font-medium">
                    {file ? file.name : 'คลิกเพื่อเลือกไฟล์ JSON'}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">หรือลากไฟล์มาวาง</p>
                </button>
              ) : (
                <div className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2 mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileJson size={14} className="text-blue-400 flex-shrink-0" />
                    <span className="text-xs text-gray-300 truncate">{file?.name}</span>
                  </div>
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={importing}
                    className="text-xs text-blue-400 hover:text-blue-300 flex-shrink-0 ml-2"
                  >
                    เปลี่ยน
                  </button>
                </div>
              )}

              {parsing && (
                <div className="mt-3 flex items-center gap-2 text-sm text-gray-400">
                  <Loader2 size={14} className="animate-spin" /> กำลังอ่านไฟล์...
                </div>
              )}

              {error && (
                <div className="mt-3 bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-3 py-2 flex items-start gap-2">
                  <AlertCircle size={14} className="mt-0.5 flex-shrink-0" /> {error}
                </div>
              )}

              {/* Preview — compact */}
              {preview && !importing && (
                <div className="mt-3">
                  <p className="text-xs text-gray-400 mb-1.5 font-medium">พบในไฟล์:</p>
                  <div className="grid grid-cols-3 gap-1.5 text-sm">
                    <Stat label="Lists" value={preview.lists} />
                    <Stat label="Cards" value={preview.cards} highlight={preview.archived > 0 ? `${preview.archived} archive` : undefined} />
                    <Stat label="Labels" value={preview.labels} />
                    <Stat label="Checklists" value={preview.checklists} />
                    <Stat label="Comments" value={preview.actions} />
                    <Stat label="Attachments" value={preview.attachments} />
                  </div>
                  <button
                    onClick={handleImport}
                    className="mt-3 w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-medium rounded-lg py-2.5 transition-all"
                  >
                    Import ทั้งหมด
                  </button>
                </div>
              )}

              {/* Progress */}
              {importing && progress && (
                <div className="mt-4 bg-white/5 rounded-lg p-4 border border-white/10">
                  <div className="flex items-center gap-2 mb-2">
                    <Loader2 size={14} className="animate-spin text-blue-400" />
                    <p className="text-sm text-gray-300">กำลัง import: {labelForStep(progress.step)}</p>
                  </div>
                  {progress.current !== undefined && progress.total !== undefined && (
                    <>
                      <div className="w-full bg-white/10 rounded-full h-1.5">
                        <div
                          className="bg-blue-500 h-1.5 rounded-full transition-all"
                          style={{ width: `${(progress.current / progress.total) * 100}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {progress.current} / {progress.total}
                      </p>
                    </>
                  )}
                </div>
              )}
            </>
          )}

          {/* Result */}
          {result && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle size={20} className="text-green-400" />
                <h3 className="text-base font-semibold text-white">Import สำเร็จ!</h3>
              </div>
              <div className="space-y-2 mb-4">
                <ResultRow label="Lists" created={result.lists.created} matched={result.lists.matched} />
                <ResultRow label="Labels" created={result.labels.created} matched={result.labels.matched} />
                <ResultRow label="Cards" created={result.cards.created} skipped={result.cards.skipped} extra={result.cards.archived > 0 ? `${result.cards.archived} archive` : undefined} />
                <ResultRow label="Checklists" created={result.checklists} />
                <ResultRow label="Checklist items" created={result.checklistItems} />
                <ResultRow label="Comments" created={result.comments} />
                <ResultRow label="Attachments" created={result.attachments} />
              </div>

              {result.errors.length > 0 && (
                <div className="mt-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 max-h-32 overflow-y-auto">
                  <p className="text-xs text-yellow-300 font-medium mb-1">
                    เตือน {result.errors.length} อัน:
                  </p>
                  {result.errors.slice(0, 5).map((e, i) => (
                    <p key={i} className="text-[11px] text-yellow-200/70 font-mono">{e}</p>
                  ))}
                  {result.errors.length > 5 && (
                    <p className="text-[11px] text-yellow-200/50 italic">...และอีก {result.errors.length - 5} อัน</p>
                  )}
                </div>
              )}

              <button
                onClick={onClose}
                className="mt-4 w-full bg-white/10 hover:bg-white/15 text-white font-medium rounded-lg py-2.5 transition-all"
              >
                เสร็จสิ้น
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: number; highlight?: string }) {
  return (
    <div className="bg-white/5 rounded px-2 py-1.5">
      <p className="text-[10px] text-gray-500 leading-tight">{label}</p>
      <p className="text-base font-semibold text-white leading-tight mt-0.5">{value}</p>
      {highlight && <p className="text-[9px] text-yellow-400 leading-tight">{highlight}</p>}
    </div>
  );
}

function ResultRow({ label, created, matched, skipped, extra }: {
  label: string; created: number; matched?: number; skipped?: number; extra?: string;
}) {
  return (
    <div className="flex items-center justify-between text-sm bg-white/5 rounded px-3 py-2">
      <span className="text-gray-300">{label}</span>
      <div className="flex items-center gap-2 text-xs">
        {created > 0 && <span className="text-green-400">+{created} ใหม่</span>}
        {matched != null && matched > 0 && <span className="text-blue-400">{matched} match</span>}
        {skipped != null && skipped > 0 && <span className="text-gray-500">{skipped} ข้าม</span>}
        {extra && <span className="text-yellow-400">{extra}</span>}
      </div>
    </div>
  );
}

function labelForStep(step: string): string {
  switch (step) {
    case 'uploading': return 'กำลังส่งไฟล์ไป server...';
    case 'processing': return 'Server กำลัง import ทุกอย่าง (รอประมาณ 30-60 วินาที)...';
    case 'lists': return 'Lists';
    case 'labels': return 'Labels';
    case 'cards': return 'Cards';
    case 'checklists': return 'Checklists';
    case 'comments': return 'Comments';
    case 'done': return 'เสร็จสิ้น';
    default: return step;
  }
}
