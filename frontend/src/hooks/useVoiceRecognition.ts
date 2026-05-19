import { useState, useRef, useCallback } from "react";

// Web Speech API 타입 직접 선언
interface ISpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onstart: ((this: ISpeechRecognition, ev: Event) => void) | null;
  onend: ((this: ISpeechRecognition, ev: Event) => void) | null;
  onresult: ((this: ISpeechRecognition, ev: ISpeechRecognitionEvent) => void) | null;
  onerror: ((this: ISpeechRecognition, ev: ISpeechRecognitionErrorEvent) => void) | null;
}

interface ISpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: ISpeechRecognitionResultList;
}

interface ISpeechRecognitionResultList {
  length: number;
  [index: number]: ISpeechRecognitionResult;
}

interface ISpeechRecognitionResult {
  isFinal: boolean;
  [index: number]: ISpeechRecognitionAlternative;
}

interface ISpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface ISpeechRecognitionErrorEvent extends Event {
  error: string;
}

declare global {
  interface Window {
    SpeechRecognition: new () => ISpeechRecognition;
    webkitSpeechRecognition: new () => ISpeechRecognition;
  }
}

interface UseMeetingRecognitionOptions {
  onTranscriptUpdate: (lines: string[]) => void;
  onError?: (error: string) => void;
}

export function useMeetingRecognition({ onTranscriptUpdate, onError }: UseMeetingRecognitionOptions) {
  const [isRecording, setIsRecording] = useState(false);
  const [interimText, setInterimText] = useState("");
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const transcriptLinesRef = useRef<string[]>([]);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isStoppingRef = useRef(false);

  const isSupported =
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  const createRecognition = useCallback(() => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognitionAPI();
    recognition.lang = "ko-KR";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event: ISpeechRecognitionEvent) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          const line = text.trim();
          if (line) {
            transcriptLinesRef.current = [...transcriptLinesRef.current, line];
            onTranscriptUpdate([...transcriptLinesRef.current]);
          }
          interim = "";
        } else {
          interim += text;
        }
      }
      setInterimText(interim);
    };

    recognition.onerror = (event: ISpeechRecognitionErrorEvent) => {
      if (event.error === "not-allowed") {
        onError?.("마이크 권한이 필요해요. 브라우저에서 허용해주세요.");
        setIsRecording(false);
      }
      // no-speech 등 일시적 오류는 자동 재시작으로 처리
    };

    recognition.onend = () => {
      // 강제 종료가 아니면 자동 재시작 (continuous 유지)
      if (!isStoppingRef.current) {
        restartTimerRef.current = setTimeout(() => {
          if (!isStoppingRef.current && recognitionRef.current) {
            try { recognitionRef.current.start(); } catch (_) { /* ignore */ }
          }
        }, 300);
      } else {
        setIsRecording(false);
        setInterimText("");
      }
    };

    return recognition;
  }, [onTranscriptUpdate, onError]);

  const startRecording = useCallback(() => {
    if (!isSupported) {
      onError?.("이 브라우저는 음성 인식을 지원하지 않아요. Chrome을 사용해주세요.");
      return;
    }
    isStoppingRef.current = false;
    transcriptLinesRef.current = [];
    onTranscriptUpdate([]);
    setInterimText("");

    const recognition = createRecognition();
    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  }, [isSupported, createRecognition, onTranscriptUpdate, onError]);

  const stopRecording = useCallback(() => {
    isStoppingRef.current = true;
    if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
    recognitionRef.current?.stop();
    recognitionRef.current = null;
  }, []);

  const clearTranscript = useCallback(() => {
    transcriptLinesRef.current = [];
    onTranscriptUpdate([]);
    setInterimText("");
  }, [onTranscriptUpdate]);

  return {
    isRecording,
    interimText,
    startRecording,
    stopRecording,
    clearTranscript,
    isSupported,
  };
}
