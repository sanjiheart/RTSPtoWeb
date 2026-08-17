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
  const handleRef = useRef<any>(null);
  // Serializes teardown-then-setup across reloads: destroy() is async, so
  // without waiting for the previous player to fully tear down, a new
  // player's attach() can race the old one's destroy() on the same <video>
  // element and silently hang (no error, no new network request — looks
  // like clicking "load" does nothing).
  const teardownRef = useRef<Promise<void>>(Promise.resolve());

  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [transcodeSpeed, setTranscodeSpeed] = useState<string>('—');
  // Which path Shaka actually picked for THIS load - never assume from the
  // browser name. Native HEVC support depends on the OS/platform too (e.g.
  // Chrome on Windows can have native HEVC via a system codec pack that
  // Chrome on Linux typically lacks), so the only reliable signal is
  // inspecting the active variant's codec after load() resolves.
  const [decodeMode, setDecodeMode] = useState<'native' | 'transcode' | null>(null);

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
        await teardownRef.current;
        if (!active) return;

        setDecodeMode(null);
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

        // `adaptiveCompute` must NOT be `false` here: @hevcjs/shaka-plugin's
        // attachComputeAware() short-circuits into a no-op whenever this is
        // false, which silently kills the onObservation telemetry below too
        // (not just the auto ABR-restriction behavior) - that's why the
        // transcode-speed readout never updated.
        const handle = registerHevcTransmuxer(window.shaka, {
          workerUrl: '/vendor/hevcjs-core/transcode-worker.js',
          wasmUrl: '/vendor/hevcjs-core/wasm/hevc-decode.js',
        });
        handleRef.current = handle;

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

        // Whether THIS browser+OS combo can decode HEVC natively - checked
        // directly, not inferred from the browser name (that's the whole
        // point: e.g. Chrome on Linux usually can't, but the identical
        // Chrome build on a Windows box with a system HEVC codec pack can).
        // Note this can't be read back from player.getVariantTracks() after
        // load() - Shaka's track metadata reports the codec as declared in
        // the manifest (hvc1/hev1), regardless of whether hevc.js silently
        // re-encoded it to avc1 before handing it to MediaSource.
        const hevcMimeCodecs = [
          'video/mp4; codecs="hvc1.1.6.L93.B0"',
          'video/mp4; codecs="hev1.1.6.L93.B0"',
          'video/mp4; codecs="hvc1"',
          'video/mp4; codecs="hev1"',
        ];
        const isNative = typeof MediaSource !== 'undefined' && hevcMimeCodecs.some(c => MediaSource.isTypeSupported(c));
        setDecodeMode(isNative ? 'native' : 'transcode');

        log(`Shaka 開始載入 fMP4 串流（${isNative ? '原生 HEVC 硬解' : 'hevc.js WASM 轉碼'}）: ${streamUrl}`, 'info');
        await player.load(streamUrl);

        if (active) {
          log('串流已順利開始播放！', 'success');
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
      const playerToDestroy = playerRef.current;
      const handleToTeardown = handleRef.current;
      playerRef.current = null;
      handleRef.current = null;
      teardownRef.current = (async () => {
        try {
          handleToTeardown?.unregister();
        } catch {
          // ignore
        }
        try {
          await playerToDestroy?.destroy();
        } catch {
          // ignore
        }
      })();
    };
  }, [scriptLoaded, streamUrl]);

  return (
    // Fills whatever height the parent gives it (rather than deriving its
    // own height from width via an aspect-ratio helper) so this can sit
    // next to the log panel with both columns sharing one explicit,
    // content-independent height - see the height rules around
    // .video-log-row in globals.css.
    <div className="position-relative w-100 h-100 rounded-4 overflow-hidden shadow-lg border border-secondary-subtle bg-black">
      <video ref={videoRef} className="w-100 h-100 object-fit-contain bg-black" controls muted playsInline />

      <div className="position-absolute top-0 start-0 m-3 d-flex align-items-center gap-2 bg-black bg-opacity-75 border border-secondary rounded-pill px-3 py-1 small font-monospace text-white z-3">
        <span className="rounded-circle bg-success animate-pulse" style={{ width: 8, height: 8 }}></span>
        <span className="fw-semibold text-success">
          Shaka Player
          {decodeMode === 'native' && ' · 原生 HEVC 解碼'}
          {decodeMode === 'transcode' && ' · hevc.js 轉碼中'}
        </span>
        {decodeMode === 'transcode' && (
          <>
            <span className="text-secondary">|</span>
            <span>轉碼速率: {transcodeSpeed}</span>
          </>
        )}
      </div>

      {!scriptLoaded && !errorMsg && (
        <div className="position-absolute top-0 start-0 w-100 h-100 bg-black bg-opacity-90 d-flex flex-column align-items-center justify-content-center text-center text-white p-4 z-2">
          <RefreshCw size={40} className="text-success mb-3 animate-spin" />
          <p className="fw-semibold mb-1">正在載入 Shaka Player...</p>
          <p className="small text-secondary">依實際偵測到的硬體能力，自動選擇原生解碼或 hevc.js 轉碼</p>
        </div>
      )}

      {errorMsg && (
        <div className="position-absolute top-0 start-0 w-100 h-100 bg-black bg-opacity-90 d-flex flex-column align-items-center justify-content-center text-center text-white p-4 z-2">
          <AlertCircle size={48} className="text-danger mb-3" />
          <p className="fw-bold text-danger mb-1">hevc.js 播放提醒</p>
          <p className="small text-secondary" style={{ maxWidth: '28rem' }}>{errorMsg}</p>
        </div>
      )}
    </div>
  );
};
