# H.265 (HEVC) HLS 播放器 — 從零開始

這個專案示範如何在瀏覽器裡播放 [RTSPtoWeb](../README.md) 輸出的 H.264 / H.265 (HEVC) HLS 串流。

**H.264 完全不需要任何特殊處理** — 任何瀏覽器的 [Shaka Player](https://github.com/shaka-project/shaka-player) 都能直接原生播放。這裡真正要解決的問題只有 **H.265**：有沒有原生 HEVC 解碼能力，**是瀏覽器＋作業系統＋硬體的組合決定的，不是單看瀏覽器名稱就能講死**。例如 Chrome 在 Linux 上通常完全沒有原生 HEVC，但同樣是 Chrome，在某些有安裝系統層 HEVC 解碼器的 Windows 機器上就偵測得到原生支援；反過來 Firefox 在 Windows 上原生 HEVC 也是要看系統有沒有裝對應的解碼器（例如「HEVC 視訊擴充功能」）才算數。

實際的判斷邏輯是：

- **有原生 HEVC 解碼能力**（不論哪個瀏覽器）：Shaka Player 直接原生解碼，完全不會觸發 hevc.js。
- **沒有原生 HEVC 解碼能力**：透過 [hevc.js](https://github.com/privaloops/hevc.js) 在瀏覽器內用 WASM 解碼 HEVC、再用 WebCodecs 重新編碼成 H.264 後播放。

這個判斷完全由 Shaka Player 在載入當下自動偵測（檢查 `MediaSource.isTypeSupported()`），兩種情況共用同一份程式碼（`components/HevcShakaPlayer.tsx`），不需要、也不應該用瀏覽器名稱寫死分岔邏輯。UI 上顯示的「原生 HEVC 解碼」或「hevc.js 轉碼中」字樣,是載入完成後從**實際生效的 codec**（`hvc1`/`hev1` = 原生、其他 = 轉碼後的 H.264）反推出來的,不是憑瀏覽器名稱猜的。

## 必要套件

```bash
yarn add shaka-player @hevcjs/core @hevcjs/shaka-plugin
```

只有這三個套件是播放器本身真正需要的：

| 套件 | 用途 |
|---|---|
| `shaka-player` | 播放器本體。單獨用它就能播放 H.264 HLS/DASH，H.264 不需要下面兩個套件。 |
| `@hevcjs/core` | 用 WASM 解碼 HEVC，再用瀏覽器的 WebCodecs API 重新編碼成 H.264。這是實際做轉碼工作的引擎。 |
| `@hevcjs/shaka-plugin` | 把 `@hevcjs/core` 包成一個 Shaka `Transmuxer` 外掛，讓 Shaka 在瀏覽器沒有原生 HEVC 解碼能力時自動呼叫它。 |

> `mp4box` 不用另外裝——它是 `@hevcjs/core` 自己的依賴，會被一起裝進來，不需要在自己的 `package.json` 裡列。`lucide-react` 之類的圖示套件只是這個 demo UI 自己用的，跟播放器本身完全無關。

## 執行期還需要的靜態檔案

`shaka-player` 沒有 `module`/`exports` 欄位，是純粹的全域腳本，要用 `<script src>` 載入，不能被打包工具直接 `import`。`@hevcjs/core` 的 `transcode-worker.js`（Worker 腳本）跟 `hevc-decode.js`/`.wasm`（WASM 解碼器）也一樣，執行期需要一個真的能被 fetch 到的網址（`new Worker(url)` / `importScripts`），不能只是打包進 bundle 裡。

所以這幾個檔案要從 `node_modules` 複製到自己網站能直接存取的靜態目錄（本專案是 `public/vendor/`），可以參考 `scripts/copy-vendor.mjs` 怎麼做,或直接抄下面這段：

```js
import { cpSync, mkdirSync } from 'node:fs';
mkdirSync('public/vendor/hevcjs-core/wasm', { recursive: true });
cpSync('node_modules/shaka-player/dist/shaka-player.compiled.debug.js', 'public/vendor/shaka-player.compiled.debug.js');
cpSync('node_modules/@hevcjs/core/dist/transcode-worker.js', 'public/vendor/hevcjs-core/transcode-worker.js');
cpSync('node_modules/@hevcjs/core/dist/wasm/hevc-decode.js', 'public/vendor/hevcjs-core/wasm/hevc-decode.js');
cpSync('node_modules/@hevcjs/core/dist/wasm/hevc-decode.wasm', 'public/vendor/hevcjs-core/wasm/hevc-decode.wasm');
// worker 會依照自己的腳本網址（不是 wasm loader 的網址）去找 .wasm，所以要多複製一份放在跟 transcode-worker.js 同一層
cpSync('node_modules/@hevcjs/core/dist/wasm/hevc-decode.wasm', 'public/vendor/hevcjs-core/hevc-decode.wasm');
```

`@hevcjs/shaka-plugin` 本身是正常的 ESM 套件，直接 `import` 讓打包工具（Webpack/Vite/Turbopack 都可以，不需要框架）處理就好，不用複製。**這一步需要某種打包工具**——單一個沒有 build 流程的 HTML 檔案沒辦法乾淨解決 `@hevcjs/shaka-plugin` 內部 `import "@hevcjs/core"` 這種 bare specifier 的模組解析問題。

## 最簡單的播放頁面

有了上面兩步，播放邏輯本身其實很短（拿掉 UI/log/錯誤處理後的核心邏輯，完整版在 `components/HevcShakaPlayer.tsx`）：

```html
<video id="video" controls></video>
<script src="/vendor/shaka-player.compiled.debug.js"></script>
<script type="module">
  import { registerHevcTransmuxer } from '@hevcjs/shaka-plugin';

  shaka.polyfill.installAll();

  const player = new shaka.Player();
  await player.attach(document.getElementById('video'));

  // 只有播 H.265 才需要這一段；純 H.264 串流可以整段跳過
  registerHevcTransmuxer(shaka, {
    workerUrl: '/vendor/hevcjs-core/transcode-worker.js',
    wasmUrl: '/vendor/hevcjs-core/wasm/hevc-decode.js',
  });

  await player.load('http://your-rtsptoweb-host:8083/stream/{STREAM_UUID}/channel/{CHANNEL_ID}/hlsfmp4/live/index.m3u8');
  document.getElementById('video').play();
</script>
```

**串流網址一定要指向 RTSPtoWeb 的 `/hlsfmp4/` 端點**（fMP4 封裝、非 low-latency），**不要**用 `/hls/`（TS 封裝，hevc.js 的轉碼外掛只認得 fMP4 mime type，不會被觸發）或 `/hlsll/`（fMP4 沒錯，但它的 partial segment 機制在原生解碼路徑上曾經出現間歇性 fatal decode error）。

## 支援要點（踩過的坑都在這）

以下任何一條沒滿足，播放大概率會失敗，而且錯誤訊息通常不會直接告訴你是哪一條沒做到——建議照這個清單逐條檢查：

1. **Node.js 22.x 與 Yarn**：本專案統一用 yarn，不要混用 npm/pnpm/bun，以免 lockfile 衝突。
2. **非 localhost 來源一定要上 HTTPS**：WebCodecs API（`VideoEncoder`/`VideoDecoder`）只在 secure context（`https://` 或 `localhost`）才會存在。用區網 IP（例如 `http://192.168.1.38:3000`）走純 HTTP 的話，這兩個 class 在**任何**瀏覽器裡都直接是 `undefined`，播放一定失敗。
3. **串流封裝必須是 fMP4，不能是 TS**：一定要指向 RTSPtoWeb 的 `/hlsfmp4/` 端點。`/hls/`（TS 封裝）不會觸發 hevc.js 的轉碼外掛——它只註冊給 `video/mp4; codecs="hev1"/"hvc1"` 這種 fMP4 mime type，TS 封裝的 HEVC 完全輪不到它處理。
4. **也不要用 low-latency HLS（`/hlsll/`）**：雖然一樣是 fMP4 封裝，但它的 partial segment + preload-hint 機制,在原生解碼路徑上曾經出現間歇性 fatal decode error（Shaka error 3014/3015，實測環境是 Firefox，但原理跟哪個瀏覽器無關——任何走原生解碼的瀏覽器理論上都可能踩到）。只有 `/hlsfmp4/`（一般節奏、完整 segment）這個端點目前驗證過穩定。
5. **需要打包工具（bundler）**：`@hevcjs/shaka-plugin` 內部用 bare specifier `import` 依賴 `@hevcjs/core`（進而依賴 `mp4box`），單一個沒有 build 流程的 HTML 檔案沒辦法解析這種 import，一定要有 Webpack/Vite/Turbopack 之類的工具（不需要框架，純打包工具即可）。
6. **worker/wasm 檔案要複製成靜態檔案**：`shaka-player`、`transcode-worker.js`、`hevc-decode.wasm` 這些不能只是打包進 JS bundle,要能被瀏覽器直接 fetch 到（詳見下一節）。
7. **原生 HEVC 支援是「瀏覽器＋作業系統」的組合，不是單一瀏覽器的固定屬性**：同一個 Chrome，在 Linux 上通常完全沒有原生 HEVC，在某些裝了系統層 HEVC 解碼器的 Windows 機器上卻偵測得到；Firefox 也一樣要看作業系統有沒有裝對應解碼器（例如 Windows 的「HEVC 視訊擴充功能」）。有原生解碼能力就走原生，沒有的話（不論哪個瀏覽器）就需要 Chrome 94+ / Edge 94+ / Firefox 都支援的 WebCodecs H.264 編碼能力來讓 hevc.js 轉碼。**不要在程式碼或文件裡寫死「這個瀏覽器一律怎樣」**——底部支援列跟播放器上的浮水印文字都是用 Shaka 實際載入後回報的 codec 反推,不是憑瀏覽器名稱猜的。
8. **原生解碼失敗時的 fallback 路徑目前有已知 bug**：如果瀏覽器因為第 7 點缺少系統解碼器而判定無法原生播放,理論上會 fallback 去用 hevc.js 轉碼——但目前 `@hevcjs/shaka-plugin` 的 `isSupported()` 只檢查 mime type 字串,沒有實際確認 `VideoEncoder` 在當前環境真的可用,遇到這種兩邊都不行的情況會直接噴 `VideoEncoder is not defined` 而不是乾淨地回報不支援（詳見「已知限制」）。
9. **區網開發模式（`yarn dev`）測試**：要在 `next.config.ts` 的 `allowedDevOrigins` 加上該裝置的來源 IP,否則 Next.js dev server 會擋掉跨來源的 dev-only 資源請求。此限制只存在於 `yarn dev`,正式的 `yarn build && yarn start` 不受影響。

## 這個 repo 已經幫你接好了

不想從零手刻的話，直接用現成的：

```bash
yarn install
yarn dev
```

打開 [http://localhost:3000](http://localhost:3000) 看完整版 Demo（含瀏覽器能力診斷面板、log console）。

**正式整合到自己的網頁，用 `<video>`，不要用 `<iframe>`。** `<iframe>` 是把整個獨立頁面塞進去，多一層導覽、多一次跨來源限制，不是正統的嵌入方式；正確做法是把「最簡單的播放頁面」那段程式碼（或 React 專案直接抄 `components/HevcShakaPlayer.tsx`）整合進自己的頁面，讓 `<video>` 元素跟 Shaka Player 直接活在你自己的 DOM 裡。

不想寫程式碼測試某條串流網址行不行，直接打開 `http://localhost:3000`（不帶 `?url=`）就會顯示輸入框，貼上網址、按「載入串流」即可；或用 `?url=...` 快速預填。

## 正式環境部署

```bash
yarn build
yarn start
```

`yarn build` 之後 `/` 是依請求動態渲染（因為要讀取 `?url=` query string）。

## 已知限制

- Shaka 原生解碼路徑的穩定性目前只在 Firefox（唯一有測到走原生解碼的環境）驗證過短時間連續播放測試，長時間、真實網路環境下的穩定性仍待持續觀察；其他會走原生解碼的瀏覽器/系統組合（例如某些 Windows 上的 Chrome）尚未特別測試過。
- 「支援要點」第 8 點提到的 `VideoEncoder is not defined` 問題目前追蹤在 [hevc.js 上游](https://github.com/privaloops/hevc.js)，尚未有修復；本專案還沒有 workaround。
- 部分 Windows GPU 驅動下，瀏覽器 HEVC 解碼能力偵測（`VideoDecoder.isConfigSupported()`）可能卡住不回應，已加上逾時保護（見 `lib/capability.ts`）。
