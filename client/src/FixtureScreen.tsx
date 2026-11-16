// Dev-only fixture screen. Frozen clock, seeded RNG, animations off (checklist 3.3 and 7).
// Results scenes are checklist 10.1.
import { useRef, useState, type ReactNode } from "react";
import { ALERT_A1, ALERT_A2, leaderboardSvg, pitchCardSvg, type ChartPitch, type PitchResult, type Results } from "@we-rankin/shared";
import type { SceneName } from "../fixtures/scenes";
import { SCENES } from "../fixtures/scenes";
import { AlertBanner } from "./realtime/AlertBanner";
import { SessionScreen } from "./realtime/SessionScreen";
import { HostConsole } from "./screens/HostConsole";
import { Notes } from "./screens/Notes";
import { RankList } from "./screens/Rank";
import { JoinPanel } from "./screens/JoinPanel";
import { Landing } from "./screens/Landing";
import { ResultsBoard } from "./screens/Results";
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
  if (scene.startsWith("ranking-") || scene.startsWith("submit-") || scene === "waiting-list") {
    const fresh = scene === "ranking-new-badge";
    const ready = scene === "submit-ok" || scene === "waiting-list";
    return sceneFrame(
      scene,
      "voting",
      <div className="row">
        {scene === "waiting-list" ? <p className="notice waiting-banner">Waiting on: Bea, Cam</p> : null}
        <RankList
          order={scene === "ranking-reordered" ? ["b", "a"] : ["a", "b"]}
          placed={fresh ? ["a"] : ["a", "b"]}
        pitches={[
          { id: "a", title: "Cat Slack", presenterName: "Bea" },
          { id: "b", title: "Parking inside Airbnbs", presenterName: "Cam" },
        ]}
        scores={[{ pitchId: "a", category: "funniness", value: 4 }, { pitchId: "b", category: "hotness", value: 8 }]}
        chips={[{ pitchId: "a", chipIds: ["huge-market"] }]}
        missing={ready ? [] : [{ kind: "score", pitchId: "b", category: "compellingness" }]}
        submitted={scene === "submit-ok"}
        />
      </div>,
    );
  }
  if (scene.startsWith("notes-")) {
    const own = scene === "notes-own-pitch";
    const upcoming = scene === "notes-upcoming-locked";
    const filled = scene === "notes-filled" || scene === "notes-chips" || scene === "notes-presenting";
    const phase = scene === "notes-upcoming-locked" || scene === "notes-empty" ? "pitching" : "voting";
    return sceneFrame(
      scene,
      phase,
      <Notes
        phase={phase}
        selfId="ada"
        saved
        pitches={[
          { id: "live", title: "Cat Slack", presenterName: own ? "Ada" : "Bea", presenterId: own ? "ada" : "bea", status: scene === "notes-presenting" || scene === "notes-empty" || upcoming ? "presenting" : "done" },
          { id: "next", title: "Parking inside Airbnbs", presenterName: "Cam", presenterId: upcoming ? "cam" : "ada", status: "upcoming" },
        ]}
        scores={filled ? [{ pitchId: "live", category: "compellingness", value: 3 }, { pitchId: "live", category: "funniness", value: 4 }, { pitchId: "live", category: "hotness", value: 8 }] : []}
        chips={scene === "notes-chips" || scene === "notes-filled" ? [{ pitchId: "live", chipIds: ["huge-market"] }] : []}
      />,
    );
  }
  if (scene.startsWith("host-")) {
    const voting = scene === "host-close-confirm" || scene === "host-waiting" || scene === "host-debug";
    const phase = scene === "host-controls" ? "pitching" : voting ? "voting" : "lobby";
    return sceneFrame(
      scene,
      phase,
      <HostConsole
        code="ABCDEF"
        phase={phase}
        initialConfirm={scene === "host-close-confirm" ? "phase" : null}
        debugOpen={scene === "host-debug"}
        players={[
          { id: "ada", name: "Ada", role: "voter", connected: true, submitted: scene !== "host-close-confirm" },
          { id: "bea", name: "Bea", role: "voter", connected: true, submitted: scene === "host-debug" },
        ]}
        pitches={
          scene === "host-pitch-form"
            ? []
            : [{ id: "p", title: "Cat Slack", presenterName: "Ada", presenterId: "ada", status: phase === "pitching" ? "upcoming" : "done" }]
        }
        counters={{ writes_failed: 1, reconnects: 2, connected: 2 }}
        hostLink="https://we-rankin.test/s/ABCDEF#h=secret"
      />,
    );
  }
  if (scene === "card-preview" || scene === "leaderboard-preview") {
    const svg = scene === "card-preview" ? pitchCardSvg(CHART_PITCHES[0]!, "QQ==") : leaderboardSvg(CHART_PITCHES, "QQ==");
    return sceneFrame(scene, "closed", <div className="chart-preview" dangerouslySetInnerHTML={{ __html: svg }} />);
  }
  if (scene === "results-borda" || scene === "results-flags" || scene === "closed-voided") {
    return sceneFrame(scene, "closed", <ResultsBoard results={fixtureResults(scene)} pitches={RESULT_PITCHES} players={RESULT_PLAYERS} />);
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

const RESULT_PITCHES = [
  { id: "a", title: "Uber for Dog Walkers, but the Dogs Pay in Tennis Balls" },
  { id: "b", title: "Slack for Cats" },
  { id: "c", title: "Airbnb for Parking Spaces Inside Airbnbs" },
  { id: "d", title: "Reservoir Dogs, a Pet Insurance Marketplace" },
];

const CHART_PITCHES: ChartPitch[] = [
  {
    pitchId: "a",
    title: "Uber for Dog Walkers, but the Dogs Pay in Tennis Balls",
    presenterName: "Ada",
    votes: { compellingness: [5, 4, 3], funniness: [4, 5, 2], hotness: [9, 7, 8] },
    categories: {
      compellingness: { mean: 4, sd: 0.8, min: 3, max: 5, p25: 3.5, p75: 4.5 },
      funniness: { mean: 3.7, sd: 1.2, min: 2, max: 5, p25: 3, p75: 4.5 },
      hotness: { mean: 8, sd: 0.8, min: 7, max: 9, p25: 7.5, p75: 8.5 },
    },
    scoreTotal: 11.7,
  },
  {
    pitchId: "b",
    title: "Slack for Cats",
    presenterName: "Bea",
    votes: { compellingness: [3, 2, 4], funniness: [5, 5, 4], hotness: [6, 5, 7] },
    categories: {
      compellingness: { mean: 3, sd: 0.8, min: 2, max: 4, p25: 2.5, p75: 3.5 },
      funniness: { mean: 4.7, sd: 0.5, min: 4, max: 5, p25: 4.5, p75: 5 },
      hotness: { mean: 6, sd: 0.8, min: 5, max: 7, p25: 5.5, p75: 6.5 },
    },
    scoreTotal: 10.7,
  },
  {
    pitchId: "c",
    title: "Airbnb for Parking Spaces Inside Airbnbs",
    presenterName: "Cam",
    votes: { compellingness: [2, 2, 3], funniness: [3, 2, 2], hotness: [4, 5, 3] },
    categories: {
      compellingness: { mean: 2.3, sd: 0.5, min: 2, max: 3, p25: 2, p75: 2.5 },
      funniness: { mean: 2.3, sd: 0.5, min: 2, max: 3, p25: 2, p75: 2.5 },
      hotness: { mean: 4, sd: 0.8, min: 3, max: 5, p25: 3.5, p75: 4.5 },
    },
    scoreTotal: 6.6,
  },
];

const RESULT_PLAYERS = [
  { id: "ada", name: "Ada" },
  { id: "bea", name: "Bea" },
  { id: "cam", name: "Cam" },
];

function stats(mean: number): PitchResult["categories"]["compellingness"] {
  return { mean, sd: 0.4, min: 1, max: 5, p25: 2, p75: 4 };
}

function row(pitchId: string, borda: number, bordaRank: number, scoreTotal: number, scoreRank: number, flag: boolean): PitchResult {
  return {
    pitchId,
    borda,
    bordaRank,
    firstPlaceCount: bordaRank === 1 ? 2 : 0,
    categories: {
      compellingness: stats(scoreTotal / 3),
      funniness: stats(scoreTotal / 3),
      hotness: stats(scoreTotal / 3),
    },
    scoreTotal,
    scoreRank,
    disagreement: flag ? { direction: bordaRank < scoreRank ? "crowd" : "scores", bordaRank, scoreRank } : null,
  };
}

function fixtureResults(scene: string): Results {
  const flagged = scene === "results-flags";
  return {
    countedPlayerIds: ["ada", "bea"],
    voidedPlayerIds: scene === "closed-voided" ? ["cam"] : [],
    pitches: [
      row("d", 0.33, 4, 6.1, flagged ? 2 : 4, flagged),
      row("a", 0.82, 1, 12.4, flagged ? 4 : 1, flagged),
      row("c", 0.51, 3, 9.2, 3, false),
      row("b", 0.64, 2, 11.1, flagged ? 1 : 2, flagged),
    ],
  };
}
