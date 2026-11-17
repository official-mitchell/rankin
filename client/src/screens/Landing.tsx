// Landing and the created-session card.
// 2026-11-16: two open buttons, Become the Game Master and Join a game. No create-key field. A pasted link or a bare session code both open the session. The join form can return to those two buttons. The choice screen explains who starts a session and who joins one. The ready card can regenerate the code or replace it with a 6-character name.
import { useEffect, useState, type FormEvent } from "react";
import { CODE_ALPHABET, CODE_LENGTH } from "@we-rankin/shared";
import { forgetSession, hostSecretKey, sessionEditedAt, touchSession } from "../host-secret";
import { hostLinkKey, sessionLinks, sessionTarget } from "./links";

export type CreatedSession = { code: string; player: string; host: string };
export const INTRO_KEY = "rankin-intro-seen";

const RULES = [
  "A game master starts the session.",
  "The game master sets the start time and the end time.",
  "No one can join late.",
  "The session starts only after people have committed.",
  "The session ends when the game master collects every response. That takes a submission from everyone, or an early close. On an early close, the game master can keep an unfinished person's votes from counting.",
  "Results are shown after the session ends.",
];

export function Landing({
  createSession,
  initialError = "",
  initialCreated = null,
  intro = "auto",
  joining = false,
  onEnter,
}: {
  createSession?: (createKey: string) => Promise<Response>;
  initialError?: string;
  initialCreated?: CreatedSession | null;
  intro?: "auto" | "open" | "closed";
  joining?: boolean;
  onEnter?: (path: string) => void;
}) {
  const [error, setError] = useState(initialError);
  const [created, setCreated] = useState<CreatedSession | null>(initialCreated);
  const [copied, setCopied] = useState("");
  const [introOpen, setIntroOpen] = useState(intro === "open");
  const [mode, setMode] = useState<"choose" | "join">(joining ? "join" : "choose");
  const [link, setLink] = useState("");
  const [sessionName, setSessionName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!introOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismissIntro();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [introOpen]);

  function dismissIntro(): void {
    window.localStorage.setItem(INTRO_KEY, "1");
    setIntroOpen(false);
  }

  async function onCreate(codes?: string[]): Promise<void> {
    setError("");
    setBusy(true);
    try {
      const response = codes ? await createNamed(codes) : await (createSession ?? defaultCreate)("");
      const failure = createFailure(response.status);
      if (failure || !response.ok) {
        setError(failure ?? "The session could not be created.");
        return;
      }
      const body = (await response.json()) as { code: string; hostSecret: string };
      const links = sessionLinks(window.location.origin, body.code, body.hostSecret);
      window.localStorage.setItem(hostSecretKey(body.code), body.hostSecret);
      window.localStorage.setItem(hostLinkKey(body.code), links.host);
      touchSession(body.code, window.localStorage);
      setCreated({ code: body.code, ...links });
      setSessionName("");
    } finally {
      setBusy(false);
    }
  }

  function onName(event: FormEvent): void {
    event.preventDefault();
    const code = sessionName.trim().toUpperCase();
    if (code.length !== CODE_LENGTH || [...code].some((char) => !CODE_ALPHABET.includes(char))) {
      setError("Use 6 letters or numbers. Skip I, L, O, 0, and 1.");
      return;
    }
    void onCreate([code]);
  }

  function onJoin(event: FormEvent): void {
    event.preventDefault();
    const target = sessionTarget(link);
    if (!target) {
      setError("Paste the game link, or the session code from that link.");
      return;
    }
    setError("");
    onEnter?.(target);
  }

  async function copy(value: string): Promise<void> {
    await navigator.clipboard.writeText(value);
    setCopied(value);
  }

  if (created) {
    return (
      <section className="panel panel--inset-frame panel--metal row" data-scene="created">
        <p className="eyebrow eyebrow--center">Session ready</p>
        <div className="code-plate">
          <div className="code-plate__code">{created.code}</div>
        </div>
        <button type="button" className="btn btn--ghost btn--block" disabled={busy} onClick={() => void onCreate()}>
          Regenerate code
        </button>
        <form className="row" onSubmit={onName}>
          <div className="field">
            <label className="label-caps" htmlFor="session-name">
              Session name
            </label>
            <input
              id="session-name"
              className="input"
              value={sessionName}
              placeholder="6 letters or numbers"
              autoComplete="off"
              maxLength={CODE_LENGTH}
              onChange={(event) => setSessionName(event.target.value)}
            />
          </div>
          <button type="submit" className="btn btn--secondary btn--block" disabled={busy}>
            Name the session
          </button>
        </form>
        {error ? (
          <p className="toast" role="alert">
            {error}
          </p>
        ) : null}
        <p className="notice">Save the host link</p>
        <p className="label">Player Link:</p>
        <p className="link-line">{created.player}</p>
        <button type="button" className="btn btn--secondary btn--block" data-copy={created.player} onClick={() => void copy(created.player)}>
          Copy player link
        </button>
        <p className="label">Host Link:</p>
        <p className="link-line">{created.host}</p>
        <button type="button" className="btn btn--secondary btn--block" data-copy={created.host} onClick={() => void copy(created.host)}>
          Copy host link
        </button>
        {copied ? <p className="label">Copied</p> : null}
        <button type="button" className="btn btn--primary btn--block btn--spaced" onClick={() => onEnter?.(`/s/${created.code}`)}>
          Create Session
        </button>
      </section>
    );
  }

  return (
    <div className="row row--center" data-scene="landing">
      {introOpen ? <Intro onDismiss={dismissIntro} /> : null}
      {mode === "join" ? (
        <form className="row" onSubmit={onJoin}>
          <div className="field">
            <label className="label-caps" htmlFor="game-link">
              Game link
            </label>
            <input
              id="game-link"
              className="input"
              value={link}
              placeholder="Paste the link or the session code"
              autoComplete="off"
              onChange={(event) => setLink(event.target.value)}
            />
          </div>
          {error ? (
            <p className="toast" role="alert">
              {error}
            </p>
          ) : null}
          <button type="submit" className="btn btn--primary btn--block">
            Join a game
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--block"
            onClick={() => {
              setError("");
              setMode("choose");
            }}
          >
            Become the Game Master
          </button>
        </form>
      ) : (
        <>
          <p className="lead">
            A game master starts the session and runs it through the results. Everyone else joins with the game link or the session code.
          </p>
          <button type="button" className="btn btn--primary btn--block" disabled={busy} onClick={() => void onCreate()}>
            Become the Game Master
          </button>
          <button type="button" className="btn btn--join btn--block" onClick={() => { setError(""); setMode("join"); }}>
            Join a game
          </button>
          <SavedSessions {...(onEnter ? { onEnter } : {})} />
        </>
      )}
    </div>
  );
}

function Intro({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="modal-scrim modal-scrim--center">
      <div className="modal modal--scroll" role="dialog" aria-modal="true" aria-labelledby="intro-title">
        <h2 className="modal__title" id="intro-title">
          Rankin'
        </h2>
        <p>
          This is a ranked-choice voting app. It uses a Borda count for live ranked-choice voting after something you just did together.
        </p>
        <ol className="rules">
          {RULES.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ol>
        <div className="modal__actions">
          <button type="button" className="btn btn--primary btn--block" onClick={onDismiss}>
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

export function createFailure(status: number): string | null {
  if (status === 401) return "That create key was not accepted. Only the game master has this key.";
  if (status >= 400) return "The session could not be created.";
  return null;
}

function savedSessionCodes(): string[] {
  const prefix = "we-rankin:host:";
  const codes: string[] = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index) ?? "";
    if (key.startsWith(prefix)) codes.push(key.slice(prefix.length));
  }
  return codes.sort((left, right) => (sessionEditedAt(right, window.localStorage) ?? 0) - (sessionEditedAt(left, window.localStorage) ?? 0));
}

function SavedSessions({ onEnter }: { onEnter?: (path: string) => void }) {
  const [codes, setCodes] = useState(savedSessionCodes);
  if (codes.length === 0) return null;
  return (
    <section className="panel panel--quiet row">
      <p className="eyebrow">Sessions on this device</p>
      {codes.map((code) => {
        const edited = sessionEditedAt(code, window.localStorage);
        return (
          <div key={code} className="row">
            <button type="button" className="btn btn--secondary btn--block" onClick={() => onEnter?.(`/s/${code}`)}>
              Rejoin {code}
            </button>
            <p className="label">{edited ? `Last edited ${new Date(edited).toLocaleString()}` : "Last edited unknown"}</p>
            <button
              type="button"
              className="btn btn--ghost btn--block"
              onClick={() => {
                forgetSession(code, window.localStorage);
                setCodes(savedSessionCodes());
              }}
            >
              Remove {code}
            </button>
          </div>
        );
      })}
    </section>
  );
}

function defaultCreate(_createKey: string): Promise<Response> {
  return fetch("/api/sessions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  });
}

function createNamed(codes: string[]): Promise<Response> {
  return fetch("/api/sessions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ codes }),
  });
}
