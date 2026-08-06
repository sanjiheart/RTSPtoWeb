'use client';

import React, { useEffect, useRef, useState } from 'react';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { registerHevcTransmuxer } from '@hevcjs/shaka-plugin';

interface Props {
  streamUrl: string;
  onLog?: (msg: string, level?: 'info' | 'warn' | 'error' | 'success') => void;
}

declare global {
  interface Window {
    shaka: any;
  }
}

export const HevcShakaPlayer: React.FC<Props> = ({ streamUrl, onLog }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playerRef = useRef<any>(null);

  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [transcodeSpeed, setTranscodeSpeed] = useState<string>('—');

  const log = (msg: string, level: 'info' | 'warn' | 'error' | 'success' = 'info') => {
    console.log(`[Shaka hevc.js] [${level.toUpperCase()}] ${msg}`);
    if (onLog) onLog(msg, level);
  };

  useEffect(() => {
    let active = true;

    const loadScripts = async () => {
      try {
        setErrorMsg(null);
        log('載入 Shaka Player 與 hevc.js 轉碼核心...', 'info');

        if (!window.shaka) {
          const shakaScript = document.createElement('script');
          shakaScript.src = '/vendor/shaka-player.compiled.debug.js';
          shakaScript.async = true;

          await new Promise((resolve, reject) => {
            shakaScript.onload = resolve;
            shakaScript.onerror = () => reject(new Error('無法載入 /vendor/shaka-player.compiled.debug.js'));
            document.body.appendChild(shakaScript);
          });
        }

        if (active) {
          setScriptLoaded(true);
          log('Shaka Player 與 hevc.js 腳本加載完成', 'success');
        }
      } catch (err: any) {
        if (active) {
          setErrorMsg(err.message || 'hevc.js 腳本載入失敗');
          log(`腳本載入錯誤: ${err.message}`, 'error');
        }
      }
    };

    loadScripts();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!scriptLoaded || !videoRef.current || typeof window === 'undefined' || !window.shaka) return;

    let active = true;
    const video = videoRef.current;

    const initShaka = async () => {
      try {
        window.shaka.polyfill.installAll();

        if (!window.shaka.Player.isBrowserSupported()) {
          throw new Error('當前瀏覽器不支援 Shaka Player API');
        }

        const player = new window.shaka.Player();
        await player.attach(video);
        playerRef.current = player;

        // Configure Shaka for Low-Latency HLS sub-fragments and buffer tolerance
        player.configure({
          streaming: {
            lowLatencyMode: true,
            inaccurateManifestTolerance: 0.5,
            rebufferingGoal: 0.5,
            bufferingGoal: 1,
            bufferBehind: 10,
            ignoreTextStreamFailures: true,
          },
          manifest: {
            hls: {
              ignoreManifestProgramDateTime: true,
            },
          },
        });

        const handle = registerHevcTransmuxer(window.shaka, {
          workerUrl: '/vendor/hevcjs-core/transcode-worker.js',
          wasmUrl: '/vendor/hevcjs-core/wasm/hevc-decode.js',
          adaptiveCompute: false,
        });

        handle.attachComputeAware(player, {
          onObservation(stat: any, avgSpeedX: number) {
            if (active && stat && stat.speedX) {
              setTranscodeSpeed(`${stat.speedX.toFixed(2)}x`);
              log(`hevc.js 轉碼速率: ${stat.speedX.toFixed(2)}x (平均 ${avgSpeedX.toFixed(2)}x)`, 'info');
            }
          },
        });

        player.addEventListener('error', (event: any) => {
          const detail = event.detail || {};
          // Suppress non-fatal buffer range warnings in debug log
          if (detail.code === 7000 || detail.code === 7002) {
            log(`Shaka HLS-LL 切片緩衝容錯通知: ${detail.message || ''}`, 'info');
            return;
          }
          log(`Shaka Error Code ${detail.code}: ${detail.message || ''}`, 'error');
          if (active) {
            setErrorMsg(`Shaka 回報錯誤 (${detail.code})`);
          }
        });

        log(`Shaka + hevc.js 開始載入 HLS-LL fMP4 串流: ${streamUrl}`, 'info');
        await player.load(streamUrl);

        if (active) {
          log('HLS-LL fMP4 串流已順利開始播放！', 'success');
          video.play().catch(e => log(`自動播放提醒: ${e.message}`, 'warn'));
        }
      } catch (err: any) {
        if (active) {
          log(`Shaka 載入失敗: ${err.message}`, 'error');
          setErrorMsg(`載入失敗: ${err.message}`);
        }
      }
    };

    initShaka();

    return () => {
      active = false;
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch {
          // ignore
        }
        playerRef.current = null;
      }
    };
  }, [scriptLoaded, streamUrl]);

  return (
    <div className="relative w-full aspect-video bg-slate-950 rounded-2xl overflow-hidden shadow-2xl border border-slate-800 flex flex-col items-center justify-center">
      <video
        ref={videoRef}
        className="w-full h-full object-contain bg-black"
        controls
        muted
        playsInline
      />

      <div className="absolute top-4 left-4 flex items-center gap-2 bg-slate-900/80 backdrop-blur-md border border-slate-700/60 px-3 py-1.5 rounded-full text-xs font-mono text-white shadow-lg z-10 pointer-events-none">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
        <span className="font-semibold text-emerald-400">Shaka + hevc.js (Chrome fMP4)</span>
        <span className="text-slate-400">|</span>
        <span className="text-slate-300">轉碼速率: {transcodeSpeed}</span>
      </div>

      {!scriptLoaded && !errorMsg && (
        <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center text-white z-20">
          <RefreshCw className="w-10 h-10 animate-spin text-emerald-400 mb-3" />
          <p className="text-sm font-semibold text-slate-200 mb-1">正在載入 Shaka Player + hevc.js 轉碼器...</p>
          <p className="text-xs text-slate-400">專為 Chrome HLS-LL (fMP4) 設計</p>
        </div>
      )}

      {errorMsg && (
        <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center text-white z-20">
          <AlertCircle className="w-12 h-12 text-rose-500 mb-3" />
          <p className="text-base font-bold text-rose-400 mb-1">hevc.js 播放提醒</p>
          <p className="text-xs text-slate-300 max-w-md mb-2">{errorMsg}</p>
        </div>
      )}
    </div>
  );
};
