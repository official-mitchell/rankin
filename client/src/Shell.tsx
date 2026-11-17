// Header, phase progress, and session tabs. 2026-11-16: title is Rankin' with a star on each side. The connection pill and the Notes / Rank / Players row are optional so the empty landing can hide both. Phase is a progress list, not a row of controls.
import type { Phase } from "@we-rankin/shared";
import type { ReactNode } from "react";

const PHASES: { id: Phase; label: string }[] = [
  { id: "lobby", label: "Lobby" },
  { id: "pitching", label: "Pitching" },
  { id: "voting", label: "Voting" },
  { id: "closed", label: "Closed" },
];

const TABS = ["Notes", "Rank", "Players"] as const;

export function Shell({
  phase,
  tab,
  onTab,
  conn = "Live",
  status = "online",
  showConn = true,
  showTabs = true,
  children,
}: {
  phase: Phase;
  tab: (typeof TABS)[number];
  onTab: (tab: (typeof TABS)[number]) => void;
  conn?: string;
  status?: "connecting" | "online" | "offline";
  showConn?: boolean;
  showTabs?: boolean;
  children: ReactNode;
}) {
  const current = PHASES.findIndex((item) => item.id === phase);
  return (
    <div className={showTabs ? "app" : "app app--solo"}>
      <header className="app-header">
        <h1 className="title">
          <span className="star" aria-hidden="true" />
          Rankin'
          <span className="star" aria-hidden="true" />
        </h1>
        {showConn ? (
          <span className="conn" data-status={status}>
            <span className="led" aria-hidden="true" />
            {conn}
          </span>
        ) : null}
      </header>
      <ol className="phase-rail" aria-label="Session progress">
        {PHASES.map((item, index) => {
          const state = index < current ? "done" : index === current ? "active" : "ahead";
          return (
            <li
              key={item.id}
              className={`phase-rail__step phase-rail__step--${state}`}
              aria-current={state === "active" ? "step" : undefined}
            >
              <span className="phase-rail__mark" aria-hidden="true" />
              {item.label}
            </li>
          );
        })}
      </ol>
      <main className="screen">{children}</main>
      {showTabs ? (
        <nav className="tabbar" aria-label="Sections">
          {TABS.map((name) => (
            <button
              key={name}
              type="button"
              className={name === tab ? "tab tab--active" : "tab"}
              onClick={() => onTab(name)}
            >
              {name}
            </button>
          ))}
        </nav>
      ) : null}
    </div>
  );
}
