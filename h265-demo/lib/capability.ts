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

  const hasMediaSource = typeof window !== 'undefined' && 'MediaSource' in window;
  let hasMediaSourceHEVC = false;
  if (hasMediaSource && window.MediaSource) {
    const hevcCodecs = [
      'video/mp4; codecs="hvc1.1.6.L93.B0"',
      'video/mp4; codecs="hev1.1.6.L93.B0"',
      'video/mp4; codecs="hvc1"',
      'video/mp4; codecs="hev1"',
    ];
    hasMediaSourceHEVC = hevcCodecs.some(codec => MediaSource.isTypeSupported(codec));
  }

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
      'hev1',
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
  };
}
