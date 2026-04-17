import { useEffect, useRef, useState } from "react";
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

export function VoiceCall({
  socket,
  enabled,
  polite,
}: {
  socket: Socket;
  enabled: boolean;
  polite: boolean;
}) {
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const [status, setStatus] = useState<"off" | "connecting" | "connected" | "failed">("off");
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setStatus("off");
      return;
    }

    let cancelled = false;
    const pc = new RTCPeerConnection({ iceServers: defaultIceServers() });
    pcRef.current = pc;

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

  return (
    <div className="callStrip">
      <span className="badge">You’re live!</span>
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
        Headphones = way less echo · mute between turns if the room feels “bouncy”
      </span>
    </div>
  );
}
