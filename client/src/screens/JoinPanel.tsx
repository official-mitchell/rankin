// Name join and reclaim (checklist 6.2).
import { NAME_MAX } from "@we-rankin/shared";
import { useState } from "react";

export function JoinPanel({
  code,
  issue = null,
  onJoin,
  onReclaim,
}: {
  code: string;
  issue?: "name_taken" | "name_in_use" | null;
  onJoin: (name: string) => void;
  onReclaim: (name: string) => void;
}) {
  const [name, setName] = useState("");
  return (
    <form
      className="panel panel--inset-frame panel--metal row"
      data-scene="join"
      onSubmit={(event) => {
        event.preventDefault();
        if (name.trim()) onJoin(name.trim());
      }}
    >
      <p className="eyebrow">
        <span className="star" aria-hidden="true" />
        Session code
        <span className="star" aria-hidden="true" />
      </p>
      <div className="code-plate">
        <div className="code-plate__code">{code}</div>
      </div>
      <div className="field">
        <label className="label-caps" htmlFor="player-name">
          Your name
        </label>
        <input
          id="player-name"
          className="input"
          placeholder="Enter name"
          value={name}
          maxLength={NAME_MAX}
          autoFocus
          onChange={(event) => setName(event.target.value)}
        />
      </div>
      {issue === "name_taken" ? (
        <div className="row">
          <p className="toast" role="alert">
            That name is taken.
          </p>
          <button type="button" className="btn btn--secondary btn--block" onClick={() => onReclaim(name.trim())}>
            That's me (reclaim)
          </button>
        </div>
      ) : null}
      {issue === "name_in_use" ? (
        <p className="toast" role="alert">
          That name is active on another device
        </p>
      ) : null}
      <button type="submit" className="btn btn--primary btn--block">
        Join
      </button>
    </form>
  );
}
