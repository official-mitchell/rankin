// Landing and the created-session card. 2026-11-16: first visit explains Rankin'. The create key stays hidden until someone elects to be the game master. A rejected key says it is the game master's secret.
import { useEffect, useState, type FormEvent } from "react";
import { hostSecretKey } from "../host-secret";
import { hostLinkKey, sessionLinks } from "./links";

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
  hosting: hostingInitial = false,
  onEnter,
}: {
  createSession?: (createKey: string) => Promise<Response>;
  initialError?: string;
  initialCreated?: CreatedSession | null;
  intro?: "auto" | "open" | "closed";
  hosting?: boolean;
  onEnter?: (path: string) => void;
}) {
  const [createKey, setCreateKey] = useState("");
  const [error, setError] = useState(initialError);
  const [created, setCreated] = useState<CreatedSession | null>(initialCreated);
  const [copied, setCopied] = useState("");
  const [introOpen, setIntroOpen] = useState(intro !== "closed" && initialCreated === null);
  const [hosting, setHosting] = useState(hostingInitial || initialError.length > 0);

  useEffect(() => {
    if (intro !== "auto" || initialCreated) return;
    if (window.localStorage.getItem(INTRO_KEY) === "1") setIntroOpen(false);
  }, [intro, initialCreated]);

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

  async function onSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setError("");
    const response = await (createSession ?? defaultCreate)(createKey);
    const failure = createFailure(response.status);
    if (failure) {
      setError(failure);
      return;
    }
    if (!response.ok) {
      setError("The session could not be created.");
      return;
    }
    const body = (await response.json()) as { code: string; hostSecret: string };
    const links = sessionLinks(window.location.origin, body.code, body.hostSecret);
    window.localStorage.setItem(hostSecretKey(body.code), body.hostSecret);
    window.localStorage.setItem(hostLinkKey(body.code), links.host);
    setCreated({ code: body.code, ...links });
  }

  async function copy(value: string): Promise<void> {
    await navigator.clipboard.writeText(value);
    setCopied(value);
  }

  if (created) {
    return (
      <section className="panel panel--inset-frame panel--metal row" data-scene="created">
        <p className="eyebrow">Session ready</p>
        <div className="code-plate">
          <div className="code-plate__code">{created.code}</div>
        </div>
        <p className="notice">Save the host link</p>
        <p className="label">Player link</p>
        <p className="link-line">{created.player}</p>
        <button type="button" className="btn btn--secondary btn--block" data-copy={created.player} onClick={() => void copy(created.player)}>
          Copy player link
        </button>
        <p className="label">Host link</p>
        <p className="link-line">{created.host}</p>
        <button type="button" className="btn btn--secondary btn--block" data-copy={created.host} onClick={() => void copy(created.host)}>
          Copy host link
        </button>
        {copied ? <p className="label">Copied</p> : null}
        <button type="button" className="btn btn--primary btn--block" onClick={() => onEnter?.(`/s/${created.code}`)}>
          Enter session
        </button>
      </section>
    );
  }

  return (
    <section className="panel panel--inset-frame panel--metal row" data-scene="landing">
      {introOpen ? <Intro onDismiss={dismissIntro} /> : null}
      {introOpen ? null : hosting ? (
        <form className="row" onSubmit={(event) => void onSubmit(event)}>
          <p className="label">This key proves you are the game master.</p>
          <div className="field">
            <label className="label-caps" htmlFor="create-key">
              Create key
            </label>
            <input id="create-key" className="input" type="password" value={createKey} onChange={(event) => setCreateKey(event.target.value)} autoComplete="off" />
          </div>
          {error ? (
            <p className="toast" role="alert">
              {error}
            </p>
          ) : null}
          <button type="submit" className="btn btn--primary btn--block">
            Create session
          </button>
        </form>
      ) : (
        <div className="row">
          <button type="button" className="btn btn--primary btn--block" onClick={() => setHosting(true)}>
            Become the game master
          </button>
          <button type="button" className="btn btn--secondary btn--block" onClick={() => setIntroOpen(true)}>
            How Rankin' works
          </button>
        </div>
      )}
    </section>
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

function defaultCreate(createKey: string): Promise<Response> {
  return fetch("/api/sessions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ createKey }),
  });
}
