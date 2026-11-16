// Reconnecting socket for checklist 5.1. Backoff runs 0.5s to 8s plus jitter.
import type { ClientView, ServerAlert } from "@we-rankin/shared";

export type ConnectionStatus = "connecting" | "online" | "offline";

const BACKOFF_MS = [500, 1000, 2000, 4000, 8000];

export type ConnectionClock = {
  schedule(fn: () => void, ms: number): number;
  cancel(id: number): void;
  listen(target: EventTarget, type: string, fn: () => void): void;
  unlisten(target: EventTarget, type: string, fn: () => void): void;
  hidden(): boolean;
  online(): boolean;
};

export function browserClock(): ConnectionClock {
  return {
    schedule: (fn, ms) => window.setTimeout(fn, ms),
    cancel: (id) => window.clearTimeout(id),
    listen: (target, type, fn) => target.addEventListener(type, fn),
    unlisten: (target, type, fn) => target.removeEventListener(type, fn),
    hidden: () => document.hidden,
    online: () => navigator.onLine,
  };
}

export function backoffDelay(attempt: number, random: () => number): number {
  const base = BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)] ?? 8000;
  return Math.round(base * (1 + random() * 0.25));
}

type ServerEnvelope = {
  type?: string;
  view?: ClientView;
  clientSeq?: number;
  code?: string;
  missing?: unknown;
  alert?: ServerAlert;
};

export class ConnectionManager {
  private socket: WebSocket | null = null;
  private timer: number | null = null;
  private attempt = 0;
  private status: ConnectionStatus = "offline";
  private opened = false;
  private stopped = false;
  private readonly onError = (event: Event) => this.reportWindowError(event);
  private readonly onRejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    const message = reason instanceof Error ? reason.message : String(reason);
    const stack = reason instanceof Error ? reason.stack : undefined;
    this.report(message, stack);
  };
  private readonly onVisible = () => {
    if (this.clock.hidden() || this.stopped || !this.clock.online()) return;
    if (this.socket?.readyState === WebSocket.OPEN) return;
    this.connectNow();
  };
  private readonly onOffline = () => {
    this.setStatus("offline");
    this.clearTimer();
    this.socket?.close();
  };
  private readonly onOnline = () => {
    if (!this.stopped) this.connectNow();
  };

  constructor(
    private readonly options: {
      code: string;
      playerId: string | null;
      hostSecret: string | null;
      socket: (url: string) => WebSocket;
      onView: (view: ClientView) => void;
      onAck: (clientSeq: number) => void;
      onCommandError: (clientSeq: number | undefined, code: string, missing?: unknown) => void;
      onAlert: (alert: ServerAlert) => void;
      onStatus: (status: ConnectionStatus, reconnect: boolean) => void;
      random?: () => number;
      clock?: ConnectionClock;
      events?: EventTarget;
      visibilityTarget?: EventTarget;
    },
  ) {}

  private visibilityTarget(): EventTarget {
    return this.options.visibilityTarget ?? document;
  }

  private get clock(): ConnectionClock {
    return this.options.clock ?? browserClock();
  }

  start(): void {
    this.stopped = false;
    const events = this.options.events ?? window;
    this.clock.listen(events, "error", this.onError as () => void);
    this.clock.listen(events, "unhandledrejection", this.onRejection as () => void);
    this.clock.listen(this.visibilityTarget(), "visibilitychange", this.onVisible);
    this.clock.listen(events, "offline", this.onOffline);
    this.clock.listen(events, "online", this.onOnline);
    this.connectNow();
  }

  stop(): void {
    this.stopped = true;
    const events = this.options.events ?? window;
    this.clock.unlisten(events, "error", this.onError as () => void);
    this.clock.unlisten(events, "unhandledrejection", this.onRejection as () => void);
    this.clock.unlisten(this.visibilityTarget(), "visibilitychange", this.onVisible);
    this.clock.unlisten(events, "offline", this.onOffline);
    this.clock.unlisten(events, "online", this.onOnline);
    this.clearTimer();
    this.socket?.close();
    this.socket = null;
  }

  send(message: unknown): void {
    if (this.socket?.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify(message));
  }

  private connectNow(): void {
    if (this.stopped || !this.clock.online()) {
      this.setStatus("offline");
      return;
    }
    this.clearTimer();
    const previous = this.socket;
    this.socket = null;
    if (previous && previous.readyState !== WebSocket.CLOSED) previous.close();
    this.setStatus("connecting");
    const origin = typeof location === "undefined" ? "ws://session.test" : location.origin.replace(/^http/, "ws");
    const socket = this.options.socket(`${origin}/api/s/${this.options.code}/ws`);
    this.socket = socket;
    socket.addEventListener("open", () => {
      this.attempt = 0;
      const reconnect = this.opened;
      this.opened = true;
      const hello: { type: "hello"; playerId?: string; hostSecret?: string } = { type: "hello" };
      if (this.options.playerId) hello.playerId = this.options.playerId;
      if (this.options.hostSecret) hello.hostSecret = this.options.hostSecret;
      socket.send(JSON.stringify(hello));
      this.setStatus("online", reconnect);
    });
    socket.addEventListener("message", (event) => this.receive(String(event.data)));
    socket.addEventListener("close", () => {
      if (this.socket !== socket || this.stopped) return;
      this.setStatus(this.clock.online() ? "offline" : "offline");
      this.schedule();
    });
  }

  private schedule(): void {
    if (this.stopped || !this.clock.online()) return;
    this.clearTimer();
    const delay = backoffDelay(this.attempt, this.options.random ?? Math.random);
    this.attempt += 1;
    this.timer = this.clock.schedule(() => this.connectNow(), delay);
  }

  private receive(raw: string): void {
    let message: ServerEnvelope;
    try {
      message = JSON.parse(raw) as ServerEnvelope;
    } catch {
      return;
    }
    if (message.type === "view" && message.view) this.options.onView(message.view);
    if (message.type === "ack" && typeof message.clientSeq === "number") this.options.onAck(message.clientSeq);
    if (message.type === "error") this.options.onCommandError(message.clientSeq, message.code ?? "error", message.missing);
    if (message.type === "serverAlert" && message.alert) this.options.onAlert(message.alert);
  }

  private reportWindowError(event: Event): void {
    const error = event as ErrorEvent;
    this.report(error.message || "error", error.error instanceof Error ? error.error.stack : undefined);
  }

  private report(message: string, stack: string | undefined): void {
    if (this.status !== "online") return;
    const body: { type: "client.error"; message: string; stack?: string } = {
      type: "client.error",
      message: message.slice(0, 500),
    };
    const short = stack?.slice(0, 1024);
    if (short) body.stack = short;
    this.send(body);
  }

  private setStatus(status: ConnectionStatus, reconnect = false): void {
    if (this.status === status && !reconnect) return;
    this.status = status;
    console.info("connection", status);
    this.options.onStatus(status, reconnect);
  }

  private clearTimer(): void {
    if (this.timer === null) return;
    this.clock.cancel(this.timer);
    this.timer = null;
  }
}
