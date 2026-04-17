/** Record microphone to a single Blob (WebM/Opus when supported). */
export async function recordVoiceClipAutoStop(maxMs: number): Promise<Blob> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
    ? "audio/webm;codecs=opus"
    : MediaRecorder.isTypeSupported("audio/webm")
      ? "audio/webm"
      : "";
  const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
  const chunks: BlobPart[] = [];
  rec.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  return new Promise((resolve, reject) => {
    rec.onerror = () => {
      stream.getTracks().forEach((t) => t.stop());
      reject(new Error("record_failed"));
    };
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      const type = rec.mimeType || "audio/webm";
      resolve(new Blob(chunks, { type }));
    };
    try {
      rec.start(200);
    } catch {
      stream.getTracks().forEach((t) => t.stop());
      reject(new Error("record_start_failed"));
      return;
    }
    window.setTimeout(() => {
      if (rec.state === "recording") rec.stop();
    }, maxMs);
  });
}
