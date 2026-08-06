# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

RTSPtoWeb converts RTSP (and RTMP) camera streams into browser-consumable formats — HLS, Low-Latency HLS, MSE (WebSocket), and WebRTC — plus re-exposes them over RTSP. It's pure Go (no FFmpeg/GStreamer), built on `github.com/deepch/vdk` for codec/container handling.

This repo (`sanjiheart/RTSPtoWeb`) is a personal fork of `deepch/RTSPtoWeb` (see README.md "客製項目"). The fork's customizations: default base image in `Dockerfile`, default credentials in `config.json`, containerized run script `start.sh`, and added `Desc`/`Format` fields on `ChannelST`. `go.mod`'s module path still reads `github.com/deepch/RTSPtoWeb` (unchanged from upstream) — don't "fix" this without checking with the user, it may be intentional to ease upstream merges. The `upstream` remote points at `deepch/RTSPtoWeb` for pulling updates.

## Commit messages

- One line, in English.
- Do not add a `Co-Authored-By` line or any other co-author attribution.

## Commands

```bash
# Build
GO111MODULE=on go build *.go      # or: make build

# Run (reads ./config.json by default)
GO111MODULE=on go run *.go        # or: make run
./RTSPtoWeb -config config.json -debug   # after building; see -help for flags

# Lint
go vet                             # or: make lint

# Integration smoke test (requires a running server + a real RTSP camera URL
# edited into the script — these are not unit tests)
bash test.curl
bash test_multi.curl
```

There is no Go unit test suite (`go test`) in this repo — verification is done via the `test.curl` / `test_multi.curl` scripts against a live running instance, and manual playback in a browser.

Everything lives in a single `package main` at the repo root — there are no internal packages/modules to navigate.

## Architecture

### Global state: `Storage`

Everything hangs off one process-wide singleton, `var Storage = NewStreamCore()` (`storageStruct.go`), built by `NewStreamCore()` in `storageConfig.go`. That function parses CLI flags (`-config`, `-debug`) and unmarshals `config.json` into `StorageST{ Server, Streams, ChannelDefaults }`.

- `StreamST` = a stream, holding a map of `ChannelST` (channel = one camera feed / URL).
- `ChannelST` holds both the persisted config (`url`, `on_demand`, `audio`, ...) *and* live runtime state: `codecs`, `sdp`, `clients map[string]ClientST`, `hlsSegmentBuffer`, `hlsMuxer`, a `signals chan int`, and `runLock`.
- New channels are merged against `ChannelDefaults` via `imdario/mergo` (`StreamChannelMake` in `storageStreamChannel.go`), so per-channel config only needs to override what differs.
- `StorageST.mutex sync.RWMutex` guards all of this. **Convention: all reads/writes to `Storage` go through methods on `*StorageST`**, each taking the lock itself (`obj.mutex.Lock()`/`RLock()` + `defer Unlock()`). Never reach into `Storage.Streams[...]` fields directly from outside `storage*.go` — follow the existing accessor-method pattern (see `storageServer.go` for simple getters, `storageStreamChannel.go`/`storageStream.go` for the stream/channel lifecycle methods).
- JSON struct tags carry a custom `groups:"api,config"` tag (used with `liip/sheriff` in `SaveConfig()`) to control which fields get serialized back out to `config.json` vs. returned over the API — check these tags before adding fields you don't want leaking into one or the other.

### File naming = subsystem

There's no directory structure; subsystem boundaries are encoded in filename prefixes:

- `storage*.go` — the `Storage` singleton: config load/save (`storageConfig.go`), server settings accessors (`storageServer.go`), stream lifecycle (`storageStream.go`), channel lifecycle/locking (`storageStreamChannel.go`), per-client streaming (`storageClient.go`), HLS segment storage (`storageStreamHLS.go`), struct/const/error defs (`storageStruct.go`).
- `apiHTTP*.go` — gin-gonic HTTP handlers, one file per concern: stream CRUD (`apiHTTPStream.go`), channel CRUD (`apiHTTPChannel.go`), HLS (`apiHTTPHLS.go`), Low-Latency HLS (`apiHTTPHLSLL.go`), MSE over WebSocket (`apiHTTPMSE.go`), WebRTC signaling (`apiHTTPWebRTC.go`), MP4 fragment export (`apiHTTPSaveMP4.go`). **Gotcha:** route registration and server bootstrap (`HTTPAPIServer()`, the gin engine setup, `CrossOrigin()`, page handlers) actually live in `apiHTTPRouter.go` — `apiHTTPServer.go` is currently just a stub (`//TODO add to next version`). Don't assume the filename maps 1:1 to content here.
- `hls*.go` — HLS muxing pipeline: `hlsMuxer.go` (muxer), `hlsSegment.go` (segmenter), `hlsFragment.go` (fMP4 fragments for LL-HLS).
- `serverRTSP.go` — the app's *own* embedded RTSP server (status codes, method constants, request handling) that re-serves ingested streams at `rtsp://.../{STREAM_ID}/{CHANNEL_ID}` on `rtsp_port` — distinct from the RTSP *client* that pulls from cameras.
- `streamCore.go` — the per-channel pull loop (`StreamServerRunStreamDo` / `StreamServerRunStream`): dials the source via `vdk/format/rtspv2` (or `vdk/format/rtmp` if the channel URL scheme is `rtmp`), then fans out each decoded `av.Packet` to the HLS muxer, connected WebRTC/MSE clients (via `ClientST.outgoingAVPacket`/`outgoingRTPPacket` channels), and the RTSP restream server.
- `RTSPtoWeb.go` — `main()`: starts `HTTPAPIServer()`, `RTSPServer()`, and `Storage.StreamChannelRunAll()` as goroutines, then blocks on SIGINT/SIGTERM for graceful shutdown (`Storage.StopAll()`).
- `streamRemoteAuthorization.go` — optional per-play token check against an external HTTP backend (`server.token`), used to gate RTSP playback (`?token=...`).
- `supportFunc.go` — small shared helpers (`generateUUID`, `stringToInt`, string extraction) and the `SignalStreamRestart`/`SignalStreamStop`/`SignalStreamClient` control-signal constants sent over `ChannelST.signals`.
- `loggingLog.go` — the package-global `log *logrus.Logger`.

### Stream lifecycle / concurrency model

- Each channel that isn't `on_demand` is started at boot by `StreamChannelRunAll()`; `on_demand` channels start lazily on first client connect via `StreamChannelRun()`.
- `runLock` on `ChannelST` prevents double-starting the same channel's pull goroutine.
- Inside the pull loop (`streamCore.go`), a `select` juggles: a 20s "has video" keyframe timeout, a 20s "still has clients" check (for on-demand channels — exits if none), inbound `ChannelST.signals` (stop/restart/no-clients-so-stop), and inbound codec/RTP signals from the vdk RTSP client. On any exit path it flushes HLS (`StreamHLSFlush`), closes the HLS muxer, and marks the channel `OFFLINE`.
- Sending `SignalStreamStop`/`SignalStreamRestart` on a channel's `signals` chan (from the storage layer, e.g. on delete/edit) is how the running goroutine is told to unwind — there's no direct goroutine handle/cancellation elsewhere.

### Config file shape

`config.json` has three top-level sections: `server` (ports, HTTP/HTTPS/auth, ICE/WebRTC settings, token backend), `streams` (map of stream-id → `{ name, channels }`), and `channel_defaults` (merged into every channel via `mergo`). See `docs/api.md` for the full HTTP API (stream/channel CRUD, HLS/HLS-LL/MSE/WebRTC/RTSP playback endpoints) and the README's "Configuration" section for the field reference.
