# H.265 (HEVC) HLS 播放器 — 嵌入指南

這個專案示範如何在瀏覽器裡播放 [RTSPtoWeb](../README.md) 輸出的 H.265 (HEVC) HLS 串流，並提供一個可以直接 `<iframe>` 嵌入的最小播放器頁面（`/embed`）。

**播放策略**：用 [Shaka Player](https://github.com/shaka-project/shaka-player) 統一處理兩種瀏覽器——

- **Chrome / Edge**：沒有原生 HEVC 解碼能力，透過 [hevc.js](https://github.com/privaloops/hevc.js) 在瀏覽器內用 WASM 解碼 HEVC、再用 WebCodecs 重新編碼成 H.264 後播放。
- **Firefox**：原生支援 HEVC，Shaka Player 直接走原生解碼，完全不會觸發 hevc.js 的轉碼流程。

兩種情況共用同一份程式碼（`components/HevcShakaPlayer.tsx`），瀏覽器差異由 Shaka Player 自動判斷,不需要額外的瀏覽器分岔邏輯。

## 前置需求

1. **Node.js** 22.x（跟 `yarn dev` 目前實測的版本一致）與 **Yarn**（本專案統一用 yarn，不要混用 npm/pnpm/bun，以免 lockfile 衝突）。
2. **瀏覽器**：
   - Chrome 94+ 或 Edge 94+（需要支援 WebCodecs 的 H.264 硬體/軟體編碼）
   - 或 Firefox（原生 HEVC 解碼 + WebCodecs H.264 編碼支援）
3. **Secure Context**：WebCodecs API 要求頁面必須是 `https://` 或 `localhost`，否則瀏覽器會直接拒絕。
4. **後端必須提供 fMP4 封裝的 HLS 端點**：也就是 RTSPtoWeb 的 `/stream/{uuid}/channel/{channel}/hlsfmp4/live/index.m3u8`。

   **不要**指向 `/hls/`（MPEG-TS 封裝）或 `/hlsll/`（low-latency partial segment）：
   - `/hls/` 是 TS 封裝，hevc.js 的轉碼外掛只認得 fMP4 mime type，不會被觸發，Chrome/Edge 會直接播放失敗。
   - `/hlsll/` 是 fMP4 封裝沒錯，但它的 partial segment + preload-hint 機制在 Firefox 原生解碼路徑上曾經出現間歇性 fatal decode error（詳見程式碼註解）。
   - 只有 `/hlsfmp4/`（一般節奏、完整 segment 的 fMP4 封裝）才是兩種瀏覽器都驗證過穩定的端點。

## 安裝與啟動（開發模式）

```bash
yarn install
yarn dev
```

打開 [http://localhost:3000](http://localhost:3000) 可以看到完整版 Demo 頁面（含瀏覽器能力診斷面板、log console，方便除錯）。

> `yarn install` 會自動觸發 `postinstall` 腳本，把 Shaka Player 跟 hevc.js 的 worker/wasm 檔案複製到 `public/vendor/`（`scripts/copy-vendor.mjs`）。`yarn dev` / `yarn build` 之前也會各自重跑一次（`predev` / `prebuild`），不需要手動處理。

若要從區網其他裝置（非 localhost）連到這台開發機測試，`next.config.ts` 的 `allowedDevOrigins` 要加上該裝置的來源 IP，否則 Next.js dev server 預設會擋掉 cross-origin 的 dev-only 資源請求。此限制只存在於 `yarn dev`，正式的 `yarn build && yarn start` 不受影響。

## 嵌入到你自己的網頁

最簡單的方式：用 `<iframe>` 指向 `/embed` 路由,並帶上 `?url=` 參數指向 RTSPtoWeb 的 fMP4 HLS manifest。

```html
<iframe
  src="http://your-demo-host:3000/embed?url=http://your-rtsptoweb-host:8083/stream/{STREAM_UUID}/channel/{CHANNEL_ID}/hlsfmp4/live/index.m3u8"
  width="960"
  height="540"
  allow="autoplay"
  style="border:0"
></iframe>
```

`/embed` 頁面沒有 header、沒有診斷面板、沒有 log console，就是一個滿版的 video player。

**不想寫 HTML 也能測試**：直接打開 `http://your-demo-host:3000/embed`（不帶 `?url=`），畫面會顯示一個輸入框,貼上 fMP4 HLS 網址、按「載入」就能播放,不用改任何程式碼。

## 正式環境部署（production build）

```bash
yarn build
yarn start
```

`yarn build` 之後 `/` 是靜態頁面、`/embed` 是依請求動態渲染（因為要讀取 `?url=` query string）。

## 已知限制

- Firefox 走 Shaka 原生解碼的穩定性目前只驗證過短時間連續播放測試，長時間、真實網路環境下的穩定性仍待持續觀察。若真的又出現播放中斷,可以參考 git 歷史裡 `hls.js` 版本的實作方式復原（`FirefoxHlsllPlayer.tsx`,目前已移除,可從 commit 記錄找回）。
- 部分 Windows GPU 驅動下，瀏覽器 HEVC 解碼能力偵測（`VideoDecoder.isConfigSupported()`）可能卡住不回應，已加上逾時保護（見 `lib/capability.ts`）,但實際硬體行為因裝置而異。
