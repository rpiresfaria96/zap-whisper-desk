import { useCallback, useEffect, useRef, useState } from "react";
import type { Message } from "@/lib/chat/types";

const NOTIFY_PREF = "ideal-zap-desktop-notifications";
const SOUND_PREF = "ideal-zap-incoming-sound";
const insecureLanOrigin = () => typeof window !== "undefined" &&
  window.isSecureContext === false &&
  !["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname);
const readPref = (key: string, fallback: boolean) => {
  if (typeof window === "undefined") return fallback;
  try { const value = localStorage.getItem(key); return value === null ? fallback : value === "true"; } catch { return fallback; }
};

export function useIncomingAlerts() {
  const [desktopEnabled, setDesktopEnabled] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [insecureOrigin, setInsecureOrigin] = useState(false);
  const desktopRef = useRef(false);
  const soundRef = useRef(false);
  const lastAlerted = useRef(new Map<string, number>());
  const audioContext = useRef<AudioContext | null>(null);

  useEffect(() => {
    const desktop = readPref(NOTIFY_PREF, false);
    const sound = readPref(SOUND_PREF, true);
    setDesktopEnabled(desktop); desktopRef.current = desktop;
    setSoundEnabled(sound); soundRef.current = sound;
    setPermission("Notification" in window ? Notification.permission : "unsupported");
    setInsecureOrigin(insecureLanOrigin());
  }, []);

  const playSound = useCallback(async () => {
    try {
      const Audio = window.AudioContext;
      if (!Audio) return;
      const ctx = audioContext.current ?? new Audio();
      audioContext.current = ctx;
      await ctx.resume();
      if (ctx.state !== "running") return;
      const time = ctx.currentTime + 0.015;
      for (const [delay, pitch] of [[0, 784], [0.13, 988]] as const) {
        const osc = ctx.createOscillator();
        const volume = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = pitch;
        volume.gain.setValueAtTime(0.0001, time + delay);
        volume.gain.exponentialRampToValueAtTime(0.07, time + delay + 0.015);
        volume.gain.exponentialRampToValueAtTime(0.0001, time + delay + 0.11);
        osc.connect(volume).connect(ctx.destination);
        osc.start(time + delay);
        osc.stop(time + delay + 0.12);
      }
    } catch {
      // Windows pode bloquear AudioContext ate haver um clique no navegador.
    }
  }, []);

  // A maioria dos navegadores bloqueia AudioContext até um gesto físico.
  // Destravar no primeiro clique ajuda no aviso mesmo com a janela em foco.
  useEffect(() => {
    const unlock = () => {
      if (!soundRef.current) return;
      try {
        // É obrigatório criar AudioContext durante um clique real.
        // Criar somente ao chegar a primeira mensagem (janela minimizada)
        // deixa o áudio suspenso por bloqueio de autoplay.
        const ctx = audioContext.current ?? new window.AudioContext();
        audioContext.current = ctx;
        void ctx.resume();
      } catch {}
    };
    window.addEventListener("pointerdown", unlock);
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  const toggleDesktop = useCallback(async () => {
    if (desktopRef.current) {
      desktopRef.current = false; setDesktopEnabled(false);
      try { localStorage.setItem(NOTIFY_PREF, "false"); } catch {}
      return;
    }
    if (typeof window === "undefined" || insecureLanOrigin()) {
      setInsecureOrigin(true); return;
    }
    if (!("Notification" in window)) {
      setPermission("unsupported"); return;
    }
    let next = Notification.permission;
    if (next === "default") next = await Notification.requestPermission();
    setPermission(next);
    const enabled = next === "granted";
    desktopRef.current = enabled; setDesktopEnabled(enabled);
    try { localStorage.setItem(NOTIFY_PREF, String(enabled)); } catch {}
  }, []);

  const toggleSound = useCallback(() => {
    const next = !soundRef.current;
    soundRef.current = next; setSoundEnabled(next);
    try { localStorage.setItem(SOUND_PREF, String(next)); } catch {}
    if (next) void playSound(); // desbloqueia o áudio em gesto do usuário
  }, [playSound]);

  const onIncoming = useCallback((message: Message, isOpen: boolean, senderName?: string) => {
    if (message.fromMe || (!desktopRef.current && !soundRef.current)) return;
    if (message.timestamp < Date.now() - 120_000) return;
    if (lastAlerted.current.has(message.id)) return;
    lastAlerted.current.set(message.id, Date.now());
    if (lastAlerted.current.size > 700) {
      lastAlerted.current.delete(lastAlerted.current.keys().next().value!);
    }
    // O usuário pediu som também quando está na conversa aberta.
    // Mostrar notificacao tambem se a conversa estiver aberta, como solicitado.
    void isOpen;
    if (soundRef.current) void playSound();
    if (desktopRef.current &&
        "Notification" in window && Notification.permission === "granted") {
      try {
        const name = typeof senderName === "string" && senderName.trim() ? senderName.trim().slice(0, 90) : "Contato do WhatsApp";
        const notification = new Notification(`${name} • Ideal-Zap`, {
          body: "Nova mensagem recebida.",
          tag: `ideal-zap-${message.id}`,
        });
        notification.onclick = () => { window.focus(); notification.close(); };
      } catch {}
    }
  }, [playSound]);

  return { desktopEnabled, soundEnabled, permission, insecureOrigin, toggleDesktop, toggleSound, onIncoming };
}
