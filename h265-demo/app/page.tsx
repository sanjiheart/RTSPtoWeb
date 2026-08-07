'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { HevcShakaPlayer } from '../components/HevcShakaPlayer';
import { DiagnosticPanel } from '../components/DiagnosticPanel';
import { LogConsole, LogEntry } from '../components/LogConsole';
import { detectCapabilities, CapabilityResult } from '../lib/capability';
import { Play, Tv, Zap, Globe } from 'lucide-react';

export default function Home() {
  // Regular-cadence fMP4 HLS (not low-latency) - avoids the partial-segment
  // timing complexity that caused Firefox+Shaka's native decode path to
  // throw intermittent fatal errors (3014/3015) on the old /hlsll/ endpoint.
  const DEFAULT_URL =
    'http://192.168.1.38:8083/stream/27aec28e-6181-4753-9acd-0456a75f0289/channel/2/hlsfmp4/live/index.m3u8';

  const [streamUrl, setStreamUrl] = useState<string>(DEFAULT_URL);
  const [inputUrl, setInputUrl] = useState<string>(DEFAULT_URL);
  const [capabilities, setCapabilities] = useState<CapabilityResult | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const addLog = useCallback((message: string, level: 'info' | 'warn' | 'error' | 'success' = 'info') => {
    const timeStr = new Date().toLocaleTimeString('zh-TW', { hour12: false });
    const newEntry: LogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      timestamp: timeStr,
      message,
      level,
    };
    setLogs(prev => [newEntry, ...prev.slice(0, 99)]);
  }, []);

  // Capability detection on mount. Some Windows GPU drivers can hang when
  // queried for HEVC decode support, so cap the whole detection at 10s and
  // fall back to a conservative "no hardware HEVC" result rather than
  // leaving the diagnostic panel stuck on its loading state forever.
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
      recommendedEngine: 'jessibuca',
      recommendationReason: '能力偵測逾時（可能是驅動程式問題），改用保守的軟解設定。',
    };

    const timeout = new Promise<CapabilityResult>(resolve =>
      setTimeout(() => resolve(fallback), 10000),
    );

    Promise.race([detectCapabilities(), timeout]).then(res => {
      setCapabilities(res);
      addLog(`瀏覽器檢測: ${res.browserName} ${res.browserVersion}`, 'info');
      addLog('統一使用 Shaka Player：Chrome/Edge 走 hevc.js 轉碼，Firefox 走原生 HEVC 解碼（改用一般節奏 fMP4 端點後，Firefox 原生解碼路徑的間歇性 fatal error 已不再重現，見 3 分鐘連續測試）', 'success');
    });
  }, [addLog]);

  const handleApplyUrl = () => {
    if (!inputUrl.trim()) return;
    setStreamUrl(inputUrl.trim());
    addLog(`載入串流網址: ${inputUrl.trim()}`, 'info');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navigation Bar */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-tr from-emerald-500 to-teal-400 rounded-xl text-slate-950 shadow-lg shadow-emerald-500/20 font-bold">
              <Tv className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-lg text-white tracking-tight flex items-center gap-2">
                RTSPtoWeb H.265 fMP4 HLS Unified Player
              </h1>
              <p className="text-xs text-slate-400">單一 fMP4 HLS 網址 • Chrome & Firefox 統一使用 Shaka Player Demo</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse"></span>
              Shaka Player 統一模式
            </span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Stream URL Input */}
        <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-4 sm:p-6 shadow-xl">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Globe className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={inputUrl}
                onChange={e => setInputUrl(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleApplyUrl();
                }}
                placeholder="請輸入 fMP4 HLS (.m3u8) 串流網址"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-sm font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition"
              />
            </div>
            <button
              type="button"
              onClick={() => handleApplyUrl()}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20"
            >
              <Play className="w-4 h-4 fill-current" /> 載入串流
            </button>
          </div>

          <div className="mt-3 flex items-center justify-between text-xs text-slate-400 font-mono">
            <div className="flex items-center gap-1 text-emerald-400">
              <Zap className="w-3.5 h-3.5" />
              <span>自動策略: Chrome/Edge 走 Shaka + hevc.js 轉碼，Firefox 走 Shaka 原生 HEVC 解碼</span>
            </div>
          </div>
        </div>

        {/* Video Player Display Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            {/* Shaka + hevc.js: Chrome/Edge transcode via WASM+WebCodecs (no native
                HEVC at all), Firefox decodes natively (hevc.js just sits unused). */}
            <HevcShakaPlayer
              streamUrl={streamUrl}
              onLog={addLog}
            />
          </div>

          {/* Side Info Panel */}
          <div className="space-y-4 flex flex-col">
            <DiagnosticPanel
              capabilities={capabilities}
              activeEngine="Shaka Player (Chrome/Edge hevc.js 轉碼 / Firefox 原生解碼)"
            />
          </div>
        </div>

        {/* Log Console */}
        <LogConsole logs={logs} onClear={() => setLogs([])} />
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-4 text-center text-xs text-slate-500">
        RTSPtoWeb H.265 fMP4 HLS Single-URL Demo • Next.js Architecture
      </footer>
    </div>
  );
}
