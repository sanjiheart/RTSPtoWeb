'use client';

import React, { useEffect, useRef, useState } from 'react';
import { RefreshCw, AlertCircle } from 'lucide-react';
import Hls from 'hls.js';

interface Props {
  streamUrl: string;
  onLog?: (msg: string, level?: 'info' | 'warn' | 'error' | 'success') => void;
}

export const FirefoxHlsllPlayer: React.FC<Props> = ({ streamUrl, onLog }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const log = (msg: string, level: 'info' | 'warn' | 'error' | 'success' = 'info') => {
    console.log(`[Firefox Player] [${level.toUpperCase()}] ${msg}`);
    if (onLog) onLog(msg, level);
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    setIsLoading(true);
    setErrorMsg(null);
    log(`Firefox 啟動原生 HLS-LL fMP4 播放器: ${streamUrl}`, 'info');

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = streamUrl;
      video
        .play()
        .then(() => {
          setIsLoading(false);
          log('Firefox 原生播放成功', 'success');
        })
        .catch(err => {
          log(`Firefox 原生播放提示: ${err.message}`, 'warn');
        });
    } else if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 10,
      });

      hls.loadSource(streamUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        log('Firefox Hls.js HLS-LL 清單解析成功', 'success');
        video
          .play()
          .then(() => {
            setIsLoading(false);
            log('Firefox Hls.js 開始播放實時畫面', 'success');
          })
          .catch(e => {
            log(`自動播放提醒: ${e.message}`, 'warn');
            setIsLoading(false);
          });
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          log(`Firefox HLS 錯誤: ${data.details}`, 'error');
          if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError();
          } else {
            setErrorMsg(`播放失敗 (${data.details})`);
            setIsLoading(false);
          }
        }
      });

      hlsRef.current = hls;
    } else {
      setErrorMsg('Firefox 當前不支援 HLS 媒體組件');
      setIsLoading(false);
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [streamUrl]);

  return (
    <div className="relative w-full aspect-video bg-slate-950 rounded-2xl overflow-hidden shadow-2xl border border-slate-800 flex flex-col items-center justify-center">
      <video
        ref={videoRef}
        className="w-full h-full object-contain bg-black"
        controls
        muted
        playsInline
        onLoadedData={() => setIsLoading(false)}
      />

      <div className="absolute top-4 left-4 flex items-center gap-2 bg-slate-900/80 backdrop-blur-md border border-slate-700/60 px-3 py-1.5 rounded-full text-xs font-mono text-white shadow-lg z-10 pointer-events-none">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
        <span className="font-semibold text-emerald-400">Firefox Native HLS-LL Engine</span>
      </div>

      {isLoading && !errorMsg && (
        <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center text-white z-20">
          <RefreshCw className="w-10 h-10 animate-spin text-emerald-400 mb-3" />
          <p className="text-sm font-semibold text-slate-200 mb-1">正在載入 Firefox 原生 HLS-LL 影音...</p>
          <p className="text-xs text-slate-400">零轉碼、零 1 秒卡死問題</p>
        </div>
      )}

      {errorMsg && (
        <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center text-white z-20">
          <AlertCircle className="w-12 h-12 text-rose-500 mb-3" />
          <p className="text-base font-bold text-rose-400 mb-1">Firefox 播放提醒</p>
          <p className="text-xs text-slate-300 max-w-md mb-2">{errorMsg}</p>
        </div>
      )}
    </div>
  );
};
