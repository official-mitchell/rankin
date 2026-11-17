// Routes: landing, live session, dev fixtures, and a 404 view. 2026-11-16: the empty landing hides the connection pill and the player tabs.
import { lazy, Suspense, useEffect, useState } from "react";
import { captureHostSecret } from "./host-secret";
import { SessionScreen } from "./realtime/SessionScreen";
import { Landing } from "./screens/Landing";
import { Shell } from "./Shell";

const FixtureScreen = import.meta.env.DEV ? lazy(() => import("./FixtureScreen")) : null;

type Tab = "Notes" | "Rank" | "Players";

export function App() {
  const [path, setPath] = useState(() => window.location.pathname);
  const [tab, setTab] = useState<Tab>("Notes");

  useEffect(() => {
    const next = captureHostSecret(window.location.href, window.localStorage);
    if (next) {
      window.history.replaceState(null, "", next);
      setPath(new URL(next, window.location.origin).pathname);
    }
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const session = path.match(/^\/s\/([^/]+)$/);
  const fixture = path.match(/^\/__fixtures\/([^/]+)$/);

  let body = <p>That page is not on the card.</p>;
  let phase: "lobby" | "pitching" | "voting" | "closed" = "lobby";
  if (path === "/") {
    body = (
      <Landing
        onEnter={(next) => {
          window.history.pushState(null, "", next);
          const cleaned = captureHostSecret(window.location.href, window.localStorage);
          if (cleaned) window.history.replaceState(null, "", cleaned);
          setPath(window.location.pathname);
        }}
      />
    );
  } else if (session) {
    return <SessionScreen code={decodeURIComponent(session[1] ?? "")} />;
  } else if (fixture && FixtureScreen) {
    return (
      <Suspense fallback={<p>Loading fixture.</p>}>
        <FixtureScreen scene={decodeURIComponent(fixture[1] ?? "")} />
      </Suspense>
    );
  }

  const landing = path === "/";
  return (
    <Shell phase={phase} tab={tab} onTab={setTab} showConn={!landing} showTabs={!landing}>
      {body}
    </Shell>
  );
}
