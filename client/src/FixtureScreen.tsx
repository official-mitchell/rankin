// Dev-only fixture screen. Frozen clock, seeded RNG, animations off (checklist 3.3).
import { useRef, useState, type ReactNode } from "react";
import { ALERT_A1, ALERT_A2 } from "@we-rankin/shared";
import type { SceneName } from "../fixtures/scenes";
import { SCENES } from "../fixtures/scenes";
import { AlertBanner } from "./realtime/AlertBanner";
import { SessionScreen } from "./realtime/SessionScreen";
import { JoinPanel } from "./screens/JoinPanel";
import { Landing } from "./screens/Landing";
import { Roster } from "./screens/Roster";
import { Shell } from "./Shell";

const FROZEN_NOW = 1_763_337_600_000;

class LabSocket extends EventTarget {
  readyState = 0;
  send(data: string): void {
    const body = JSON.parse(data) as { type?: string; clientSeq?: number };
    if (body.type === "hello" || body.clientSeq === undefined) return;
    this.readyState = 1;
    queueMicrotask(() => {
      this.dispatchEvent(new MessageEvent("message", { data: JSON.stringify({ type: "ack", clientSeq: body.clientSeq }) }));
    });
  }
  close(): void {
    this.readyState = 3;
    this.dispatchEvent(new Event("close"));
  }
  open(): void {
    this.readyState = 1;
    this.dispatchEvent(new Event("open"));
  }
}

function QueueLab() {
  const [sent, setSent] = useState("");
  const socket = useRef((url: string) => {
    void url;
    const next = new LabSocket();
    queueMicrotask(() => next.open());
    return next as unknown as WebSocket;
  }).current;
  return (
    <>
      <SessionScreen
        code="LABCOD"
        lab
        socket={socket}
        onSend={(message) => {
          const seq = (message as { clientSeq?: number }).clientSeq;
          if (!seq) return;
          setSent((current) => (current ? `${current},${seq}` : String(seq)));
        }}
      />
      <p data-sent={sent}>{sent}</p>
    </>
  );
}

function sceneFrame(scene: string, phase: "lobby" | "pitching" | "voting" | "closed", body: ReactNode) {
  return (
    <div className="is-frozen" data-scene={scene}>
      <Shell phase={phase} tab="Players" onTab={() => undefined}>
        {body}
      </Shell>
    </div>
  );
}

export default function FixtureScreen({ scene }: { scene: string }) {
  if (scene === "queue-lab") return <QueueLab />;
  if (scene === "landing") return sceneFrame(scene, "lobby", <Landing createSession={async () => new Response(null, { status: 204 })} />);
  if (scene === "create-key-error") {
    return sceneFrame(scene, "lobby", <Landing initialError="That create key was not accepted." createSession={async () => new Response(null, { status: 401 })} />);
  }
  if (scene === "created") {
    return sceneFrame(
      scene,
      "lobby",
      <Landing
        initialCreated={{ code: "ABCDEF", player: "https://we-rankin.test/s/ABCDEF", host: "https://we-rankin.test/s/ABCDEF#h=secret" }}
      />,
    );
  }
  if (scene === "join" || scene === "join-name-taken" || scene === "join-name-in-use") {
    const issue = scene === "join-name-taken" ? "name_taken" : scene === "join-name-in-use" ? "name_in_use" : null;
    return sceneFrame(scene, "lobby", <JoinPanel code="ABCDEF" issue={issue} onJoin={() => undefined} onReclaim={() => undefined} />);
  }
  if (scene === "lobby-player" || scene === "lobby-host" || scene === "spectator") {
    return sceneFrame(
      scene,
      "lobby",
      <Roster
        isHost={scene === "lobby-host"}
        spectator={scene === "spectator"}
        phase="lobby"
        players={[
          { id: "ada", name: "Ada", role: "voter", connected: true, host: true },
          { id: "bea", name: "Bea", role: "voter", connected: true },
          { id: "cam", name: "Cam", role: "spectator", connected: false },
        ]}
        pitches={[{ id: "p", title: "A pitch", presenterName: "Ada" }]}
      />,
    );
  }
  Date.now = () => FROZEN_NOW;
  Math.random = () => 0.42;
  const entry = SCENES[scene as SceneName];
  const conn = scene === "saving" ? "Saving…" : scene === "offline-pending" ? "Offline — 2 pending" : "Live";
  const status = scene === "offline-pending" ? "offline" : scene === "saving" ? "online" : "online";
  const alert = scene === "banner-a1" ? ALERT_A1 : scene === "banner-a2" ? ALERT_A2 : null;
  if (!entry) {
    return (
      <Shell phase="lobby" tab="Notes" onTab={() => undefined}>
        <p>Unknown fixture.</p>
      </Shell>
    );
  }
  return (
    <div className="is-frozen" data-scene={scene} data-now={String(Date.now())}>
      <Shell phase={entry.phase} tab="Notes" onTab={() => undefined} conn={conn} status={status}>
        <AlertBanner alert={alert} isHost={alert !== null} onDownload={() => undefined} />
        <p>
          {entry.phase} · {entry.pitches.length} pitches · {entry.players.length} players
        </p>
      </Shell>
    </div>
  );
}
