'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { HevcShakaPlayer } from '../components/HevcShakaPlayer';
import { FirefoxHlsllPlayer } from '../components/FirefoxHlsllPlayer';
import { DiagnosticPanel } from '../components/DiagnosticPanel';
import { LogConsole, LogEntry } from '../components/LogConsole';
import { detectCapabilities, CapabilityResult } from '../lib/capability';
import { Play, Tv, Zap, Globe } from 'lucide-react';

export default function Home() {
  // Single Unified HLS-LL URL
  const DEFAULT_HLSLL_URL =
    'http://192.168.1.38:8083/stream/27aec28e-6181-4753-9acd-0456a75f0289/channel/2/hlsll/live/index.m3u8';

  const [streamUrl, setStreamUrl] = useState<string>(DEFAULT_HLSLL_URL);
  const [inputUrl, setInputUrl] = useState<string>(DEFAULT_HLSLL_URL);
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

      if (res.browserName === 'Firefox') {
        addLog('Firefox 策略啟動: 使用 FirefoxHlsllPlayer 原生播放 HLS-LL fMP4（實測 Shaka 在此環境下的原生解碼路徑不穩定，會間歇性 fatal decode error，改回 hls.js）', 'success');
      } else {
        addLog('Chrome/Edge 策略啟動: 使用 Shaka + hevc.js 轉碼模式 (解鎖 H.265 播放)', 'success');
      }
    });
  }, [addLog]);

  const handleApplyUrl = () => {
    if (!inputUrl.trim()) return;
    setStreamUrl(inputUrl.trim());
    addLog(`載入 HLS-LL 串流網址: ${inputUrl.trim()}`, 'info');
  };

  const isFirefox = capabilities?.browserName === 'Firefox';

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
                RTSPtoWeb H.265 HLS-LL Unified Player
              </h1>
              <p className="text-xs text-slate-400">單一 HLS-LL 網址 • Chrome & Firefox 通用順暢播放 Demo</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse"></span>
              {isFirefox ? 'Firefox 模式 (Native Hls.js)' : 'Chrome/Edge 模式 (hevc.js)'}
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
                placeholder="請輸入 HLS-LL (.m3u8) 串流網址"
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
              <span>自動策略: {isFirefox ? 'Firefox 停用 hevc.js 改用 Native Hls.js 直接播放 fMP4（Shaka 原生解碼在此環境下不穩定）' : 'Chrome/Edge 使用 Shaka + hevc.js 轉碼播放'}</span>
            </div>
          </div>
        </div>

        {/* Video Player Display Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            {isFirefox ? (
              /* Firefox: Shaka's native-decode path threw intermittent fatal decode
                 errors (code 3014/3015) in this environment, so use hls.js instead. */
              <FirefoxHlsllPlayer
                streamUrl={streamUrl}
                onLog={addLog}
              />
            ) : (
              /* Chrome/Edge have no native HEVC support at all, so hevc.js's
                 WASM decode + WebCodecs re-encode transcode path is required. */
              <HevcShakaPlayer
                streamUrl={streamUrl}
                onLog={addLog}
              />
            )}
          </div>

          {/* Side Info Panel */}
          <div className="space-y-4 flex flex-col">
            <DiagnosticPanel
              capabilities={capabilities}
              activeEngine={isFirefox ? 'Firefox Native HLS-LL Engine (hls.js)' : 'Shaka + hevc.js (Chrome/Edge 轉碼器)'}
            />
          </div>
        </div>

        {/* Log Console */}
        <LogConsole logs={logs} onClear={() => setLogs([])} />
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-4 text-center text-xs text-slate-500">
        RTSPtoWeb H.265 HLS-LL Single-URL Demo • Next.js Architecture
      </footer>
    </div>
  );
}
