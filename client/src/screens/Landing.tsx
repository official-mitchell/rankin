// Landing and the created-session card (checklist 6.1).
import { useState, type FormEvent } from "react";
import { hostSecretKey } from "../host-secret";
import { hostLinkKey, sessionLinks } from "./links";

export type CreatedSession = { code: string; player: string; host: string };

export function Landing({
  createSession,
  initialError = "",
  initialCreated = null,
  onEnter,
}: {
  createSession?: (createKey: string) => Promise<Response>;
  initialError?: string;
  initialCreated?: CreatedSession | null;
  onEnter?: (path: string) => void;
}) {
  const [createKey, setCreateKey] = useState("");
  const [error, setError] = useState(initialError);
  const [created, setCreated] = useState<CreatedSession | null>(initialCreated);
  const [copied, setCopied] = useState("");

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
    <form className="panel panel--inset-frame panel--metal row" data-scene="landing" onSubmit={(event) => void onSubmit(event)}>
      <p className="eyebrow">Rank the pitches. Settle it by Borda.</p>
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
  );
}

export function createFailure(status: number): string | null {
  if (status === 401) return "That create key was not accepted.";
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
