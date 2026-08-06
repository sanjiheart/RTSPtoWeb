export interface CapabilityResult {
  browserName: string;
  browserVersion: string;
  hasWebCodecs: boolean;
  hasWebCodecsHEVC: boolean;
  webCodecsCodecName: string;
  hasMediaSource: boolean;
  hasMediaSourceHEVC: boolean;
  hasWasm: boolean;
  hasWasmSimd: boolean;
  recommendedEngine: 'hlsjs' | 'webcodecs' | 'jessibuca';
  recommendationReason: string;
}

// Some Windows GPU drivers hang (never resolve or reject) when queried for
// HEVC hardware decode support via WebCodecs. Race against a timeout so a
// stuck driver call can't block capability detection forever.
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>(resolve => setTimeout(() => resolve(fallback), ms)),
  ]);
}

export async function detectCapabilities(): Promise<CapabilityResult> {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  let browserName = 'Unknown';
  let browserVersion = '';

  if (ua.includes('Firefox/')) {
    browserName = 'Firefox';
    browserVersion = ua.split('Firefox/')[1]?.split(' ')[0] || '';
  } else if (ua.includes('Edg/')) {
    browserName = 'Edge';
    browserVersion = ua.split('Edg/')[1]?.split(' ')[0] || '';
  } else if (ua.includes('Chrome/')) {
    browserName = 'Chrome';
    browserVersion = ua.split('Chrome/')[1]?.split(' ')[0] || '';
  } else if (ua.includes('Safari/')) {
    browserName = 'Safari';
    browserVersion = ua.split('Version/')[1]?.split(' ')[0] || '';
  }

  // 1. Test WASM
  const hasWasm = typeof WebAssembly !== 'undefined';
  let hasWasmSimd = false;
  if (hasWasm && typeof WebAssembly.validate === 'function') {
    const simdBytecode = new Uint8Array([
      0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
      0x01, 0x05, 0x01, 0x60, 0x00, 0x01, 0x7b, 0x03,
      0x02, 0x01, 0x00, 0x0a, 0x13, 0x01, 0x11, 0x00,
      0xfd, 0x0c, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x0b
    ]);
    hasWasmSimd = WebAssembly.validate(simdBytecode);
  }

  // 2. Test MediaSource HEVC support
  const hasMediaSource = typeof window !== 'undefined' && 'MediaSource' in window;
  let hasMediaSourceHEVC = false;
  if (hasMediaSource && window.MediaSource) {
    const hevcCodecs = [
      'video/mp4; codecs="hvc1.1.6.L93.B0"',
      'video/mp4; codecs="hev1.1.6.L93.B0"',
      'video/mp4; codecs="hvc1"',
      'video/mp4; codecs="hev1"'
    ];
    hasMediaSourceHEVC = hevcCodecs.some(codec => MediaSource.isTypeSupported(codec));
  }

  // 3. Test WebCodecs HEVC support
  const hasWebCodecs = typeof window !== 'undefined' && 'VideoDecoder' in window;
  let hasWebCodecsHEVC = false;
  let webCodecsCodecName = '';

  if (hasWebCodecs && window.VideoDecoder) {
    const testCodecs = [
      'hvc1.1.6.L93.B0',
      'hev1.1.6.L93.B0',
      'hvc1.1.6.L120.B0',
      'hev1.1.6.L120.B0',
      'hvc1',
      'hev1'
    ];

    for (const codec of testCodecs) {
      try {
        const configCheck = await withTimeout(
          window.VideoDecoder.isConfigSupported({ codec }),
          1500,
          { supported: false } as VideoDecoderSupport,
        );
        if (configCheck.supported) {
          hasWebCodecsHEVC = true;
          webCodecsCodecName = codec;
          break;
        }
      } catch {
        // try next
      }
    }
  }

  // Recommendation logic per browser:
  let recommendedEngine: 'hlsjs' | 'webcodecs' | 'jessibuca' = 'hlsjs';
  let recommendationReason = '';

  if (browserName === 'Firefox') {
    recommendedEngine = 'hlsjs';
    recommendationReason = `檢測到 ${browserName} 瀏覽器，預設使用 Hls.js / HTML5 原生播放引擎（最佳相容性與順暢播放）。`;
  } else if (hasWebCodecsHEVC) {
    recommendedEngine = 'webcodecs';
    recommendationReason = `檢測到 ${browserName} 支援 WebCodecs (${webCodecsCodecName})，推薦使用 WebCodecs 引擎以達到超低延遲。`;
  } else {
    recommendedEngine = 'jessibuca';
    recommendationReason = `檢測到 ${browserName} 無原生 HEVC 硬解，推薦使用 Jessibuca WASM 軟解引擎繪製影音畫面。`;
  }

  return {
    browserName,
    browserVersion,
    hasWebCodecs,
    hasWebCodecsHEVC,
    webCodecsCodecName,
    hasMediaSource,
    hasMediaSourceHEVC,
    hasWasm,
    hasWasmSimd,
    recommendedEngine,
    recommendationReason
  };
}
