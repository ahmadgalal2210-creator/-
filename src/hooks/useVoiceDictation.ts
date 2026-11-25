import { useCallback, useEffect, useRef, useState } from 'react';

export type VoiceDictationState = 'idle' | 'recording' | 'transcribing';

interface UseVoiceDictationOptions {
  onTranscript: (text: string) => void;
  onStatus?: (msg: string) => void;
}

export function formatVoiceSeconds(seconds: number): string {
  const mins = Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0');
  const secs = (seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

export function useVoiceDictation({
  onTranscript,
  onStatus,
}: UseVoiceDictationOptions) {
  const [state, setState] = useState<VoiceDictationState>('idle');
  const [seconds, setSeconds] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const liveTranscriptRef = useRef('');
  const speechRecRef = useRef<{ stop: () => void } | null>(null);
  const onTranscriptRef = useRef(onTranscript);
  const onStatusRef = useRef(onStatus);

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  useEffect(() => {
    onStatusRef.current = onStatus;
  }, [onStatus]);

  const stopSpeechRec = useCallback(() => {
    if (speechRecRef.current) {
      try {
        speechRecRef.current.stop();
      } catch {
        // ignore
      }
      speechRecRef.current = null;
    }
  }, []);

  const stopTracks = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
  }, []);

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    stopSpeechRec();
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== 'inactive'
    ) {
      try {
        mediaRecorderRef.current.onstop = null;
        mediaRecorderRef.current.stop();
      } catch {
        // ignore
      }
    }
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
    stopTracks();
    setState('idle');
    setSeconds(0);
  }, [stopSpeechRec, stopTracks]);

  useEffect(() => {
    return () => {
      cancel();
    };
  }, [cancel]);

  const toggle = useCallback(async () => {
    if (state === 'transcribing') return;

    if (state === 'recording') {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      stopSpeechRec();
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== 'inactive'
      ) {
        mediaRecorderRef.current.stop();
      } else {
        stopTracks();
        setState('idle');
        setSeconds(0);
      }
      return;
    }

    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      onStatusRef.current?.('المتصفح لا يدعم الوصول للميكروفون في هذا السياق');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      audioChunksRef.current = [];
      liveTranscriptRef.current = '';

      const preferredTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus',
      ];
      const supportedMime =
        typeof MediaRecorder !== 'undefined'
          ? preferredTypes.find((t) => MediaRecorder.isTypeSupported(t)) || ''
          : '';

      const recorder = supportedMime
        ? new MediaRecorder(stream, { mimeType: supportedMime })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (evt) => {
        if (evt.data && evt.data.size > 0) {
          audioChunksRef.current.push(evt.data);
        }
      };

      recorder.onstop = async () => {
        stopTracks();
        mediaRecorderRef.current = null;

        const mime = recorder.mimeType || supportedMime || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: mime });
        audioChunksRef.current = [];

        if (audioBlob.size < 400) {
          setState('idle');
          setSeconds(0);
          onStatusRef.current?.('التسجيل قصير جداً — اضغط وتحدث بوضوح');
          return;
        }

        setState('transcribing');

        try {
          const base64DataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () =>
              typeof reader.result === 'string'
                ? resolve(reader.result)
                : reject(new Error('read failed'));
            reader.onerror = () => reject(new Error('read failed'));
            reader.readAsDataURL(audioBlob);
          });

          const res = await fetch('/api/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              audioBase64: base64DataUrl,
              mimeType: mime,
            }),
          });
          const data = (await res.json().catch(() => ({}))) as {
            text?: string;
            error?: string;
          };
          const transcribed = (
            data.text ||
            liveTranscriptRef.current ||
            ''
          ).trim();

          if (res.ok && transcribed) {
            onTranscriptRef.current(transcribed);
            onStatusRef.current?.('تم تحويل الصوت إلى نص بنجاح');
          } else if (liveTranscriptRef.current.trim()) {
            onTranscriptRef.current(liveTranscriptRef.current.trim());
            onStatusRef.current?.('تم تحويل الصوت إلى نص بنجاح');
          } else {
            onStatusRef.current?.(
              data.error || 'تعذر تفريغ الصوت — يرجى المحاولة مرة أخرى'
            );
          }
        } catch {
          if (liveTranscriptRef.current.trim()) {
            onTranscriptRef.current(liveTranscriptRef.current.trim());
            onStatusRef.current?.('تم تحويل الصوت إلى نص بنجاح');
          } else {
            onStatusRef.current?.('تعذر تفريغ التسجيل الصوتي حالياً');
          }
        } finally {
          setState('idle');
          setSeconds(0);
        }
      };

      const SpeechRecognition =
        (
          window as unknown as {
            SpeechRecognition?: new () => unknown;
            webkitSpeechRecognition?: new () => unknown;
          }
        ).SpeechRecognition ||
        (
          window as unknown as {
            webkitSpeechRecognition?: new () => unknown;
          }
        ).webkitSpeechRecognition;

      if (SpeechRecognition) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const rec = new (SpeechRecognition as any)();
          rec.lang = 'ar-EG';
          rec.continuous = true;
          rec.interimResults = false;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          rec.onresult = (evt: any) => {
            const parts: string[] = [];
            for (let i = 0; i < evt.results.length; i++) {
              const t = evt.results[i]?.[0]?.transcript;
              if (t) parts.push(t);
            }
            liveTranscriptRef.current = parts.join(' ').trim();
          };
          rec.onerror = () => {
            // Silent fallback only; MediaRecorder handles real recording
          };
          rec.start();
          speechRecRef.current = rec;
        } catch {
          // ignore
        }
      }

      recorder.start(250);
      setSeconds(0);
      setState('recording');
      timerRef.current = setInterval(() => {
        setSeconds((s) => s + 1);
      }, 1000);
      onStatusRef.current?.('جاري التسجيل الصوتي — اضغط إيقاف عند الانتهاء');
    } catch (err) {
      setState('idle');
      const errName = (err as { name?: string })?.name || '';
      if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
        onStatusRef.current?.(
          'يرجى السماح بصلاحية الميكروفون من المتصفح ثم المحاولة مجدداً'
        );
      } else if (errName === 'NotFoundError') {
        onStatusRef.current?.('لم يتم العثور على جهاز ميكروفون متصل');
      } else {
        onStatusRef.current?.('تعذر بدء التسجيل الصوتي');
      }
    }
  }, [state, stopSpeechRec, stopTracks]);

  const transcribeFile = useCallback(async (file: File) => {
    if (state !== 'idle') return;
    const isAudioExt = /\.(mp3|wav|m4a|ogg|opus|webm|aac|flac)$/i.test(file.name);
    if (!file.type.startsWith('audio/') && !isAudioExt) {
      onStatusRef.current?.('يرجى اختيار ملف صوتي صالح (MP3, WAV, M4A, OGG, WebM)');
      return;
    }

    setState('transcribing');
    onStatusRef.current?.(`جاري تفريغ الملف الصوتي «${file.name}»...`);

    try {
      const base64DataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () =>
          typeof reader.result === 'string'
            ? resolve(reader.result)
            : reject(new Error('read failed'));
        reader.onerror = () => reject(new Error('read failed'));
        reader.readAsDataURL(file);
      });

      const res = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioBase64: base64DataUrl,
          mimeType: file.type || 'audio/webm',
          fileName: file.name,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        text?: string;
        error?: string;
      };
      const transcribed = (data.text || '').trim();
      if (res.ok && transcribed) {
        onTranscriptRef.current(transcribed);
        onStatusRef.current?.(`تم تفريغ «${file.name}» وكتابته بنجاح`);
      } else {
        onStatusRef.current?.(
          data.error || 'تعذر تفريغ الملف الصوتي — تأكد من وضوح الصوت'
        );
      }
    } catch {
      onStatusRef.current?.('تعذر تفريغ الملف الصوتي حالياً');
    } finally {
      setState('idle');
      setSeconds(0);
    }
  }, [state]);

  return { state, seconds, toggle, transcribeFile, cancel };
}
