/**
 * How the inbox gets an agent's attention when a case needs a human: a short
 * chime, and a browser notification while the tab is in the background.
 * Neither carries customer content — the socket event has none to give.
 */

let audio: AudioContext | null = null;
let lastChime = 0;

/** Two soft notes; at most one chime every few seconds, however busy the queue. */
export function playSupportChime(): void {
  if (typeof window === "undefined") return;
  const now = Date.now();
  if (now - lastChime < 4_000) return;
  lastChime = now;
  try {
    const Context =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Context) return;
    audio ??= new Context();
    const start = audio.currentTime;
    [880, 1320].forEach((frequency, index) => {
      const oscillator = audio!.createOscillator();
      const gain = audio!.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      const at = start + index * 0.14;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.18, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.25);
      oscillator.connect(gain).connect(audio!.destination);
      oscillator.start(at);
      oscillator.stop(at + 0.26);
    });
  } catch {
    // Browsers block audio until the page has had a click; the badge still updates.
  }
}

export type SupportNotificationPermission = NotificationPermission | "unsupported";

export function supportNotificationPermission(): SupportNotificationPermission {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

export async function requestSupportNotifications(): Promise<SupportNotificationPermission> {
  if (supportNotificationPermission() === "unsupported") return "unsupported";
  return Notification.requestPermission();
}

/** A notification when the tab is not in front; clicking it opens the case. */
export function notifySupportAgent(input: {
  title: string;
  body: string;
  conversationId: string;
}): void {
  if (supportNotificationPermission() !== "granted") return;
  if (typeof document !== "undefined" && document.visibilityState === "visible") return;
  try {
    const notification = new Notification(input.title, {
      body: input.body,
      tag: `support-${input.conversationId}`,
    });
    notification.onclick = () => {
      window.focus();
      window.location.assign(`/support?c=${input.conversationId}`);
      notification.close();
    };
  } catch {
    // Some browsers only allow notifications from a service worker.
  }
}
