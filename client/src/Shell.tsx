// Header, phase rail, and bottom tabs (checklist 3.2). The connection pill shows checklist 5.3 states.
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
  children,
}: {
  phase: Phase;
  tab: (typeof TABS)[number];
  onTab: (tab: (typeof TABS)[number]) => void;
  conn?: string;
  status?: "connecting" | "online" | "offline";
  children: ReactNode;
}) {
  return (
    <div className="app">
      <header className="app-header">
        <h1 className="title">
          <span className="star" aria-hidden="true" />
          We Rankin'
        </h1>
        <span className="conn" data-status={status}>
          <span className="led" aria-hidden="true" />
          {conn}
        </span>
      </header>
      <nav className="phase-rail" aria-label="Phase">
        {PHASES.map((item) => (
          <span
            key={item.id}
            className={item.id === phase ? "phase-rail__step phase-rail__step--active" : "phase-rail__step"}
          >
            {item.label}
          </span>
        ))}
      </nav>
      <main className="screen">{children}</main>
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
    </div>
  );
}
