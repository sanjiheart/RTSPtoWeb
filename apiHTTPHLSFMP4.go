package main

import (
	"time"

	"github.com/deepch/vdk/format/mp4f"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
)

// HTTPAPIServerStreamHLSFMP4M3U8 send client m3u8 play list, fMP4-packaged
// segments at regular (non-low-latency) cadence. Exists for players such as
// Shaka Player's hevc.js transmuxer that only recognize fMP4 HEVC segments
// and don't need (or want) the added complexity of low-latency partial
// segments.
func HTTPAPIServerStreamHLSFMP4M3U8(c *gin.Context) {
	requestLogger := log.WithFields(logrus.Fields{
		"module":  "http_hlsfmp4",
		"stream":  c.Param("uuid"),
		"channel": c.Param("channel"),
		"func":    "HTTPAPIServerStreamHLSFMP4M3U8",
	})

	if !Storage.StreamChannelExist(c.Param("uuid"), c.Param("channel")) {
		c.IndentedJSON(500, Message{Status: 0, Payload: ErrorStreamNotFound.Error()})
		requestLogger.WithFields(logrus.Fields{
			"call": "StreamChannelExist",
		}).Errorln(ErrorStreamNotFound.Error())
		return
	}

	if !RemoteAuthorization("HLS", c.Param("uuid"), c.Param("channel"), c.Query("token"), c.ClientIP()) {
		requestLogger.WithFields(logrus.Fields{
			"call": "RemoteAuthorization",
		}).Errorln(ErrorStreamUnauthorized.Error())
		return
	}

	c.Header("Content-Type", "application/vnd.apple.mpegurl")
	Storage.StreamChannelRun(c.Param("uuid"), c.Param("channel"))
	//If stream mode on_demand need wait ready segment's
	for i := 0; i < 40; i++ {
		index, seq, err := Storage.StreamHLSFMP4m3u8(c.Param("uuid"), c.Param("channel"))
		if err != nil {
			c.IndentedJSON(500, Message{Status: 0, Payload: err.Error()})
			requestLogger.WithFields(logrus.Fields{
				"call": "StreamHLSFMP4m3u8",
			}).Errorln(err.Error())
			return
		}
		if seq >= 5 {
			_, err := c.Writer.Write([]byte(index))
			if err != nil {
				c.IndentedJSON(400, Message{Status: 0, Payload: err.Error()})
				requestLogger.WithFields(logrus.Fields{
					"call": "Write",
				}).Errorln(err.Error())
				return
			}
			return
		}
		time.Sleep(1 * time.Second)
	}
}

// HTTPAPIServerStreamHLSFMP4Init send client the fMP4 initialization segment
func HTTPAPIServerStreamHLSFMP4Init(c *gin.Context) {
	requestLogger := log.WithFields(logrus.Fields{
		"module":  "http_hlsfmp4",
		"stream":  c.Param("uuid"),
		"channel": c.Param("channel"),
		"func":    "HTTPAPIServerStreamHLSFMP4Init",
	})

	if !Storage.StreamChannelExist(c.Param("uuid"), c.Param("channel")) {
		c.IndentedJSON(500, Message{Status: 0, Payload: ErrorStreamNotFound.Error()})
		requestLogger.WithFields(logrus.Fields{
			"call": "StreamChannelExist",
		}).Errorln(ErrorStreamNotFound.Error())
		return
	}

	if !RemoteAuthorization("HLS", c.Param("uuid"), c.Param("channel"), c.Query("token"), c.ClientIP()) {
		requestLogger.WithFields(logrus.Fields{
			"call": "RemoteAuthorization",
		}).Errorln(ErrorStreamUnauthorized.Error())
		return
	}

	codecs, err := Storage.StreamChannelCodecs(c.Param("uuid"), c.Param("channel"))
	if err != nil {
		c.IndentedJSON(500, Message{Status: 0, Payload: err.Error()})
		requestLogger.WithFields(logrus.Fields{
			"call": "StreamChannelCodecs",
		}).Errorln(err.Error())
		return
	}
	Muxer := mp4f.NewMuxer(nil)
	err = Muxer.WriteHeader(codecs)
	if err != nil {
		c.IndentedJSON(500, Message{Status: 0, Payload: err.Error()})
		requestLogger.WithFields(logrus.Fields{
			"call": "WriteHeader",
		}).Errorln(err.Error())
		return
	}
	c.Header("Content-Type", "video/mp4")
	_, buf := Muxer.GetInit(codecs)
	_, err = c.Writer.Write(buf)
	if err != nil {
		c.IndentedJSON(500, Message{Status: 0, Payload: err.Error()})
		requestLogger.WithFields(logrus.Fields{
			"call": "Write",
		}).Errorln(err.Error())
		return
	}
}

// HTTPAPIServerStreamHLSFMP4Segment send client an fMP4 media segment, muxed
// on demand from the same packet buffer StreamHLSTS uses for the TS variant.
func HTTPAPIServerStreamHLSFMP4Segment(c *gin.Context) {
	requestLogger := log.WithFields(logrus.Fields{
		"module":  "http_hlsfmp4",
		"stream":  c.Param("uuid"),
		"channel": c.Param("channel"),
		"func":    "HTTPAPIServerStreamHLSFMP4Segment",
	})

	c.Header("Content-Type", "video/mp4")
	if !Storage.StreamChannelExist(c.Param("uuid"), c.Param("channel")) {
		c.IndentedJSON(500, Message{Status: 0, Payload: ErrorStreamNotFound.Error()})
		requestLogger.WithFields(logrus.Fields{
			"call": "StreamChannelExist",
		}).Errorln(ErrorStreamNotFound.Error())
		return
	}
	codecs, err := Storage.StreamChannelCodecs(c.Param("uuid"), c.Param("channel"))
	if err != nil {
		c.IndentedJSON(500, Message{Status: 0, Payload: err.Error()})
		requestLogger.WithFields(logrus.Fields{
			"call": "StreamChannelCodecs",
		}).Errorln(err.Error())
		return
	}
	Muxer := mp4f.NewMuxer(nil)
	err = Muxer.WriteHeader(codecs)
	if err != nil {
		requestLogger.WithFields(logrus.Fields{
			"call": "WriteHeader",
		}).Errorln(err.Error())
		return
	}
	seqData, err := Storage.StreamHLSTS(c.Param("uuid"), c.Param("channel"), stringToInt(c.Param("seq")))
	if err != nil {
		c.IndentedJSON(500, Message{Status: 0, Payload: err.Error()})
		requestLogger.WithFields(logrus.Fields{
			"call": "StreamHLSTS",
		}).Errorln(err.Error())
		return
	}
	if len(seqData) == 0 {
		c.IndentedJSON(500, Message{Status: 0, Payload: ErrorStreamNotHLSSegments.Error()})
		requestLogger.WithFields(logrus.Fields{
			"call": "seqData",
		}).Errorln(ErrorStreamNotHLSSegments.Error())
		return
	}
	for _, v := range seqData {
		err = Muxer.WritePacket4(*v)
		if err != nil {
			requestLogger.WithFields(logrus.Fields{
				"call": "WritePacket4",
			}).Errorln(err.Error())
			return
		}
	}
	buf := Muxer.Finalize()
	_, err = c.Writer.Write(buf)
	if err != nil {
		requestLogger.WithFields(logrus.Fields{
			"call": "Write",
		}).Errorln(err.Error())
		return
	}
}
