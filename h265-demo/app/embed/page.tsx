'use client';

import React, { use, useState } from 'react';
import { HevcShakaPlayer } from '../../components/HevcShakaPlayer';
import { Play, Globe } from 'lucide-react';

interface PageProps {
  searchParams: Promise<{ url?: string }>;
}

// Minimal embeddable player: URL bar + video, nothing else.
// Pure embed (pre-filled, no manual input needed):
//   <iframe src="https://your-host/embed?url=<hlsfmp4 index.m3u8 URL>">
// Or open /embed directly and type a URL in to test without touching code.
export default function EmbedPage({ searchParams }: PageProps) {
  const initialUrl = use(searchParams).url ?? '';
  const [inputUrl, setInputUrl] = useState(initialUrl);
  const [streamUrl, setStreamUrl] = useState(initialUrl);

  const handleLoad = () => {
    if (!inputUrl.trim()) return;
    setStreamUrl(inputUrl.trim());
  };

  return (
    <div className="w-screen h-screen bg-black flex flex-col">
      <div className="flex gap-2 p-2 bg-slate-900 border-b border-slate-800 shrink-0">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-500">
            <Globe className="w-3.5 h-3.5" />
          </div>
          <input
            type="text"
            value={inputUrl}
            onChange={e => setInputUrl(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleLoad();
            }}
            placeholder="貼上 fMP4 HLS (.m3u8) 網址"
            className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
          />
        </div>
        <button
          type="button"
          onClick={handleLoad}
          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg flex items-center gap-1 shrink-0"
        >
          <Play className="w-3.5 h-3.5 fill-current" /> 載入
        </button>
      </div>

      <div className="flex-1 min-h-0">
        {streamUrl ? (
          <HevcShakaPlayer streamUrl={streamUrl} />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm font-mono p-6 text-center">
            請輸入 fMP4 HLS 網址並按「載入」
          </div>
        )}
      </div>
    </div>
  );
}
