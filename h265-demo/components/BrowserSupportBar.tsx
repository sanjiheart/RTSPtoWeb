'use client';

import React from 'react';
import { Cpu } from 'lucide-react';
import { CapabilityResult } from '../lib/capability';

interface Props {
  capabilities: CapabilityResult | null;
}

const Chip: React.FC<{ label: string; ok: boolean | null; detail?: string }> = ({ label, ok, detail }) => (
  <span className={`badge rounded-pill text-bg-${ok === null ? 'secondary' : ok ? 'success' : 'danger'} fw-normal fs-6`}>
    {label}
    {detail && <span className="ms-1 font-monospace opacity-75">{detail}</span>}
  </span>
);

export const BrowserSupportBar: React.FC<Props> = ({ capabilities }) => {
  return (
    <footer className="border-top border-secondary-subtle bg-body-tertiary">
      <div className="container-xl py-3 d-flex flex-wrap align-items-center gap-2">
        <span className="d-flex align-items-center gap-1 text-secondary fw-medium me-1">
          <Cpu size={16} />
          目前瀏覽器支援：
        </span>
        {!capabilities ? (
          <span className="text-secondary">偵測中...</span>
        ) : (
          <>
            <Chip label={`${capabilities.browserName} ${capabilities.browserVersion}`} ok={null} />
            <Chip label="原生 HEVC 硬解 (MediaSource)" ok={capabilities.hasMediaSourceHEVC} />
            <Chip
              label="WebCodecs HEVC 解碼"
              ok={capabilities.hasWebCodecsHEVC}
              detail={capabilities.hasWebCodecsHEVC ? capabilities.webCodecsCodecName : undefined}
            />
            <Chip label="WebAssembly" ok={capabilities.hasWasm} />
            <Chip label="WASM SIMD" ok={capabilities.hasWasmSimd} />
          </>
        )}
      </div>
    </footer>
  );
};
