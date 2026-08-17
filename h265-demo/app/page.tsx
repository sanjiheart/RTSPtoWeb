'use client';

import React, { use, useCallback, useEffect, useState } from 'react';
import { HevcShakaPlayer } from '../components/HevcShakaPlayer';
import { LogConsole, LogEntry } from '../components/LogConsole';
import { BrowserSupportBar } from '../components/BrowserSupportBar';
import { detectCapabilities, CapabilityResult } from '../lib/capability';
import { Play, Tv, Globe } from 'lucide-react';

interface PageProps {
  searchParams: Promise<{ url?: string }>;
}

export default function Home({ searchParams }: PageProps) {
  // No default stream URL on purpose - this file is committed to a public
  // repo, so nothing here should point at a real, reachable camera. ?url=
  // still pre-fills when explicitly given (e.g. a link someone constructs
  // themselves); otherwise the field starts blank and you paste your own.
  const initialUrl = use(searchParams).url ?? '';
  const [streamUrl, setStreamUrl] = useState(initialUrl);
  const [inputUrl, setInputUrl] = useState(initialUrl);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [capabilities, setCapabilities] = useState<CapabilityResult | null>(null);

  const addLog = useCallback((message: string, level: LogEntry['level'] = 'info') => {
    const timestamp = new Date().toLocaleTimeString('zh-TW', { hour12: false });
    setLogs(prev => [{ id: `${prev.length}-${timestamp}-${message.slice(0, 10)}`, timestamp, message, level }, ...prev.slice(0, 199)]);
  }, []);

  // Capability detection for the bottom support bar. Some Windows GPU
  // drivers can hang when queried for HEVC decode support, so cap the whole
  // detection at 10s and fall back to a conservative result.
  useEffect(() => {
    const fallback: CapabilityResult = {
      browserName: 'Unknown',
      browserVersion: '',
      hasWebCodecs: false,
      hasWebCodecsHEVC: false,
      webCodecsCodecName: '',
      hasMediaSource: typeof window !== 'undefined' && 'MediaSource' in window,
      hasMediaSourceHEVC: false,
      hasWasm: typeof WebAssembly !== 'undefined',
      hasWasmSimd: false,
    };
    const timeout = new Promise<CapabilityResult>(resolve => setTimeout(() => resolve(fallback), 10000));
    Promise.race([detectCapabilities(), timeout]).then(setCapabilities);
  }, []);

  const handleLoad = () => {
    if (!inputUrl.trim()) return;
    setStreamUrl(inputUrl.trim());
  };

  return (
    <div className="min-vh-100 bg-body text-body d-flex flex-column">
      <header className="border-bottom border-secondary-subtle bg-body-tertiary">
        <div className="container-xl d-flex align-items-center gap-3 py-3">
          <div className="p-2 bg-success bg-gradient rounded-3 text-dark shadow-sm">
            <Tv size={20} />
          </div>
          <div>
            <h1 className="fw-bold fs-4 mb-0">RTSPtoWeb H.265 fMP4 HLS Player</h1>
            <p className="small text-secondary mb-0">Shaka Player 依實際偵測到的硬體能力，自動選擇原生 HEVC 解碼或 hevc.js 轉碼</p>
          </div>
        </div>
      </header>

      <main className="flex-grow-1 d-flex align-items-center justify-content-center px-3 py-5">
        <div className="container-xl">
          <div className="input-group mx-auto mb-4" style={{ maxWidth: '48rem' }}>
            <span className="input-group-text bg-body-tertiary border-secondary-subtle">
              <Globe size={16} />
            </span>
            <input
              type="text"
              value={inputUrl}
              onChange={e => setInputUrl(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleLoad();
              }}
              placeholder="請輸入 fMP4 HLS (.m3u8) 串流網址"
              className="form-control form-control-lg font-monospace border-secondary-subtle"
            />
            <button type="button" onClick={handleLoad} className="btn btn-success d-flex align-items-center gap-2">
              <Play size={16} fill="currentColor" /> 載入串流
            </button>
          </div>

          {streamUrl ? (
            // Both columns share one explicit, content-independent height
            // (see .video-log-row in globals.css) - flexbox stretch alone
            // can't bound the log panel's height, since a sibling's own
            // "natural" size (used to size the shared row) already accounts
            // for all of its unclipped content, so nothing ever actually
            // caps it without an independent height set on the row itself.
            <div className="row g-4 video-log-row">
              <div className="col-12 col-lg-6 video-col">
                <HevcShakaPlayer streamUrl={streamUrl} onLog={addLog} />
              </div>
              <div className="col-12 col-lg-6 log-panel-col">
                <LogConsole logs={logs} onClear={() => setLogs([])} />
              </div>
            </div>
          ) : (
            <div
              className="ratio ratio-16x9 rounded-4 border border-secondary-subtle mx-auto"
              style={{ maxWidth: '48rem', borderStyle: 'dashed' }}
            >
              <div className="d-flex align-items-center justify-content-center text-secondary bg-body-tertiary rounded-4">
                貼上串流網址並按「載入串流」開始播放
              </div>
            </div>
          )}
        </div>
      </main>

      <BrowserSupportBar capabilities={capabilities} />
    </div>
  );
}
