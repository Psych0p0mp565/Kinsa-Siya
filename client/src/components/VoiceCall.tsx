import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { SOCKET_EVENTS } from "@guess-who/shared";

function defaultIceServers(): RTCIceServer[] {
  const raw = import.meta.env.VITE_ICE_SERVERS_JSON;
  if (raw) {
    try {
      return JSON.parse(raw) as RTCIceServer[];
    } catch {
      /* fall through */
    }
  }
  return [{ urls: "stun:stun.l.google.com:19302" }];
}

const DC_LABEL = "voiceNote";
const META_MAGIC = [0x56, 0x4e, 0x02] as const;
const CHUNK = 16 * 1024;

export type VoiceCallHandle = {
  /** True when the WebRTC data channel for voice clips is open (peer-to-peer). */
  isVoiceClipReady: () => boolean;
  /** Send a short audio clip directly to the other player (no server transcription). */
  sendVoiceBlob: (blob: Blob) => Promise<void>;
};

async function waitForDcOpen(getDc: () => RTCDataChannel | null, timeoutMs: number): Promise<RTCDataChannel> {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const dc = getDc();
    if (dc?.readyState === "open") return dc;
    await new Promise((r) => setTimeout(r, 80));
  }
  throw new Error("voice_clip_channel_timeout");
}

export const VoiceCall = forwardRef<
  VoiceCallHandle,
  {
    socket: Socket;
    enabled: boolean;
    polite: boolean;
    /** "full" = voice duel (clips + hint). "chatOnly" = Classic optional live mic. */
    variant?: "full" | "chatOnly";
    /** Called when a full voice clip arrives from the peer (object URL — revoke when done). */
    onVoiceClip?: (objectUrl: string) => void;
    /** Fires when the peer-to-peer voice-clip channel opens or closes. */
    onVoiceClipChannel?: (open: boolean) => void;
  }
>(function VoiceCall({ socket, enabled, polite, variant = "full", onVoiceClip, onVoiceClipChannel }, ref) {
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const rxRef = useRef<{ total: number; mime: string; got: number; acc: Uint8Array } | null>(null);
  const onClipRef = useRef(onVoiceClip);
  const onChannelRef = useRef(onVoiceClipChannel);
  const [status, setStatus] = useState<"off" | "connecting" | "connected" | "failed">("off");
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    onClipRef.current = onVoiceClip;
  }, [onVoiceClip]);
  useEffect(() => {
    onChannelRef.current = onVoiceClipChannel;
  }, [onVoiceClipChannel]);

  useImperativeHandle(
    ref,
    () => ({
      isVoiceClipReady: () => dcRef.current?.readyState === "open",
      sendVoiceBlob: async (blob: Blob) => {
        const dc = await waitForDcOpen(() => dcRef.current, 20_000);
        const ab = await blob.arrayBuffer();
        const mime = blob.type || "audio/webm";
        const mimeEnc = new TextEncoder().encode(mime);
        if (mimeEnc.length > 65535) throw new Error("mime_too_long");
        const meta = new ArrayBuffer(3 + 4 + 2 + mimeEnc.length);
        const view = new DataView(meta);
        const out = new Uint8Array(meta);
        out[0] = META_MAGIC[0];
        out[1] = META_MAGIC[1];
        out[2] = META_MAGIC[2];
        view.setUint32(3, ab.byteLength, true);
        view.setUint16(7, mimeEnc.length, true);
        out.set(mimeEnc, 9);
        dc.send(meta);
        const src = new Uint8Array(ab);
        let off = 0;
        while (off < src.length) {
          const end = Math.min(off + CHUNK, src.length);
          dc.send(src.subarray(off, end).buffer);
          off = end;
          while (dc.bufferedAmount > 256 * 1024 && dc.readyState === "open") {
            await new Promise((r) => setTimeout(r, 12));
          }
        }
      },
    }),
    [],
  );

  useEffect(() => {
    if (!enabled) {
      setStatus("off");
      return;
    }

    let cancelled = false;
    const pc = new RTCPeerConnection({ iceServers: defaultIceServers() });
    pcRef.current = pc;
    rxRef.current = null;

    const wireDataChannel = (dc: RTCDataChannel) => {
      dc.binaryType = "arraybuffer";
      dcRef.current = dc;
      dc.onmessage = (ev: MessageEvent<ArrayBuffer>) => {
        const data = ev.data;
        if (!(data instanceof ArrayBuffer)) return;
        const u = new Uint8Array(data);
        if (
          rxRef.current === null &&
          u.length >= 9 &&
          u[0] === META_MAGIC[0] &&
          u[1] === META_MAGIC[1] &&
          u[2] === META_MAGIC[2]
        ) {
          const dv = new DataView(data);
          const total = dv.getUint32(3, true);
          const mimeLen = dv.getUint16(7, true);
          if (total > 8 * 1024 * 1024 || u.length < 9 + mimeLen) return;
          const mime = new TextDecoder().decode(u.subarray(9, 9 + mimeLen));
          rxRef.current = { total, mime, got: 0, acc: new Uint8Array(total) };
          return;
        }
        if (!rxRef.current) return;
        const rx = rxRef.current;
        if (rx.got + u.length > rx.total) {
          rxRef.current = null;
          return;
        }
        rx.acc.set(u, rx.got);
        rx.got += u.length;
        if (rx.got === rx.total) {
          const blob = new Blob([rx.acc], { type: rx.mime });
          const url = URL.createObjectURL(blob);
          onClipRef.current?.(url);
          rxRef.current = null;
        }
      };
      dc.onopen = () => onChannelRef.current?.(true);
      dc.onclose = () => onChannelRef.current?.(false);
    };

    if (polite) {
      const dc = pc.createDataChannel(DC_LABEL, { ordered: true });
      wireDataChannel(dc);
    } else {
      pc.ondatachannel = (ev) => {
        if (ev.channel.label !== DC_LABEL) return;
        wireDataChannel(ev.channel);
      };
    }

    const onIce = (payload: { candidate?: RTCIceCandidateInit | null }) => {
      if (!payload?.candidate) return;
      void pc.addIceCandidate(payload.candidate);
    };

    const onOffer = async (payload: { sdp: string }) => {
      if (polite) return;
      try {
        await pc.setRemoteDescription({ type: "offer", sdp: payload.sdp });
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit(SOCKET_EVENTS.webrtcAnswer, { sdp: answer.sdp });
      } catch {
        setStatus("failed");
      }
    };

    const onAnswer = async (payload: { sdp: string }) => {
      if (!polite) return;
      try {
        await pc.setRemoteDescription({ type: "answer", sdp: payload.sdp });
      } catch {
        setStatus("failed");
      }
    };

    socket.on(SOCKET_EVENTS.webrtcOffer, onOffer);
    socket.on(SOCKET_EVENTS.webrtcAnswer, onAnswer);
    socket.on(SOCKET_EVENTS.webrtcIce, onIce);

    pc.onicecandidate = (ev) => {
      if (ev.candidate) socket.emit(SOCKET_EVENTS.webrtcIce, { candidate: ev.candidate.toJSON() as RTCIceCandidateInit });
    };

    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      if (s === "connected") setStatus("connected");
      if (s === "failed" || s === "disconnected" || s === "closed") setStatus("failed");
    };

    pc.ontrack = (ev) => {
      const el = remoteAudioRef.current;
      if (!el) return;
      el.srcObject = ev.streams[0] ?? null;
      void el.play().catch(() => undefined);
    };

    void (async () => {
      setStatus("connecting");
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        localStreamRef.current = stream;
        stream.getTracks().forEach((tr) => {
          tr.enabled = !muted;
          pc.addTrack(tr, stream);
        });

        if (polite) {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit(SOCKET_EVENTS.webrtcOffer, { sdp: offer.sdp });
        }
      } catch {
        setStatus("failed");
      }
    })();

    return () => {
      cancelled = true;
      socket.off(SOCKET_EVENTS.webrtcOffer, onOffer);
      socket.off(SOCKET_EVENTS.webrtcAnswer, onAnswer);
      socket.off(SOCKET_EVENTS.webrtcIce, onIce);
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      dcRef.current = null;
      rxRef.current = null;
      pc.close();
      pcRef.current = null;
      const el = remoteAudioRef.current;
      if (el) el.srcObject = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- remount on polite flip only
  }, [enabled, polite, socket]);

  useEffect(() => {
    const s = localStreamRef.current;
    if (!s) return;
    s.getAudioTracks().forEach((t) => {
      t.enabled = !muted;
    });
  }, [muted]);

  if (!enabled) return null;

  const foot =
    variant === "chatOnly"
      ? "Headphones = less echo · mute when you’re not talking · both players need this on to connect"
      : "Headphones = way less echo · mute between turns if the room feels “bouncy” · voice clips use the same peer link (no typing)";

  return (
    <div className="callStrip">
      <span className="badge">{variant === "chatOnly" ? "Voice chat" : "You’re live!"}</span>
      <span className="muted">
        {status === "connecting"
          ? "Linking you up…"
          : status === "connected"
            ? "You’re in!"
            : status === "failed"
              ? "Hmm — try headphones or check the mic"
              : "Off"}
      </span>
      <button type="button" onClick={() => setMuted((m) => !m)} disabled={status !== "connected"}>
        {muted ? "Unmute" : "Mute"}
      </button>
      <audio ref={remoteAudioRef} autoPlay playsInline />
      <span className="muted" style={{ fontSize: 12 }}>
        {foot}
      </span>
    </div>
  );
});

VoiceCall.displayName = "VoiceCall";
