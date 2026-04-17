type WebSpeechRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((ev: { results: { [k: number]: { [k: number]: { transcript: string } } } }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

export function getSpeechRecognition(): WebSpeechRecognition | null {
  const w = window as unknown as { SpeechRecognition?: new () => WebSpeechRecognition; webkitSpeechRecognition?: new () => WebSpeechRecognition };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!Ctor) return null;
  return new Ctor();
}

export function listenOnce(lang: string): Promise<string> {
  const rec = getSpeechRecognition();
  if (!rec) return Promise.reject(new Error("no_speech_api"));
  return new Promise((resolve, reject) => {
    rec.lang = lang;
    rec.interimResults = false;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    let settled = false;
    const finish = (text: string) => {
      if (settled) return;
      settled = true;
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
      resolve(text);
    };
    const fail = () => {
      if (settled) return;
      settled = true;
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
      reject(new Error("speech_error"));
    };
    rec.onresult = (ev) => {
      const text = ev.results[0]?.[0]?.transcript ?? "";
      finish(text);
    };
    rec.onerror = () => fail();
    rec.onend = () => {
      if (!settled) finish("");
    };
    try {
      rec.start();
    } catch (e) {
      reject(e);
    }
  });
}
