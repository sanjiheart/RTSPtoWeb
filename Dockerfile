# syntax=docker/dockerfile:1

FROM --platform=linux/amd64 golang:1.19.4-alpine3.17 AS builder

RUN apk add git

WORKDIR /go/src/app
COPY . .

ARG TARGETOS TARGETARCH TARGETVARIANT

ENV CGO_ENABLED=0
RUN go get \
    && go mod download \
    && GOOS=${TARGETOS} GOARCH=${TARGETARCH} GOARM=${TARGETVARIANT#"v"} go build -a -o rtsp-to-web

FROM alpine:3.17

WORKDIR /app

COPY --from=builder /go/src/app/rtsp-to-web /app/
COPY --from=builder /go/src/app/web /app/web

RUN mkdir -p /config
COPY --from=builder /go/src/app/config.json /config

ENV GO111MODULE="on"
ENV GIN_MODE="release"

CMD ["./rtsp-to-web", "--config=/config/config.json"]
