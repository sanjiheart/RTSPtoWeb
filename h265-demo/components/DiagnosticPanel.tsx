'use client';

import React from 'react';
import { CapabilityResult } from '../lib/capability';
import { CheckCircle2, XCircle, Cpu, Zap } from 'lucide-react';

interface Props {
  capabilities: CapabilityResult | null;
  activeEngine: string;
}

export const DiagnosticPanel: React.FC<Props> = ({ capabilities, activeEngine }) => {
  if (!capabilities) {
    return (
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 text-slate-400 text-sm animate-pulse flex items-center justify-center">
        正在偵測瀏覽器 H.265 (HEVC) 解碼能力...
      </div>
    );
  }

  return (
    <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6 shadow-2xl text-slate-100">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-lg text-white">瀏覽器與 H.265 硬軟解能力診斷</h3>
            <p className="text-xs text-slate-400">
              {capabilities.browserName} {capabilities.browserVersion}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-slate-800/80 px-3.5 py-1.5 rounded-full border border-slate-700 text-xs font-mono">
          <span className="text-slate-400">當前啟動引擎:</span>
          <span className="text-emerald-400 font-semibold">{activeEngine.toUpperCase()}</span>
        </div>
      </div>

      {/* Capability Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* WebCodecs API */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400 tracking-wide uppercase">WebCodecs API (GPU)</span>
            {capabilities.hasWebCodecsHEVC ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            ) : (
              <XCircle className="w-5 h-5 text-amber-400" />
            )}
          </div>
          <div>
            <div className="text-base font-bold text-white mb-1">
              {capabilities.hasWebCodecsHEVC ? '支援 H.265 硬體解碼' : '未啟用/無原生 HEVC'}
            </div>
            <p className="text-xs text-slate-400">
              VideoDecoder API 解碼後繪製至 Canvas
            </p>
          </div>
        </div>

        {/* MediaSource MSE */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400 tracking-wide uppercase">MediaSource (MSE)</span>
            {capabilities.hasMediaSourceHEVC ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            ) : (
              <XCircle className="w-5 h-5 text-rose-400" />
            )}
          </div>
          <div>
            <div className="text-base font-bold text-white mb-1">
              {capabilities.hasMediaSourceHEVC ? '支援 原生 MSE 播放' : '不支援 Chrome/Firefox MSE'}
            </div>
            <p className="text-xs text-slate-400">
              hls.js / &lt;video&gt; 標籤直接播放限制
            </p>
          </div>
        </div>

        {/* WebAssembly WASM */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400 tracking-wide uppercase">WebAssembly (WASM)</span>
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <div className="text-base font-bold text-white mb-1">
              {capabilities.hasWasmSimd ? '支援 WASM SIMD 加速' : '支援 WASM 軟解'}
            </div>
            <p className="text-xs text-slate-400">
              Chrome/Firefox 軟解繪製 Canvas 的安全備援機制
            </p>
          </div>
        </div>
      </div>

      {/* Recommendation Banner */}
      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex items-start gap-3 text-emerald-300 text-xs leading-relaxed">
        <Zap className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-white mr-1">推薦播放策略說明：</span>
          {capabilities.recommendationReason}
        </div>
      </div>
    </div>
  );
};
