// Domain types for checklist 2.1. Host view counters were added for checklist 7.3.
export type Phase = "lobby" | "pitching" | "voting" | "closed";

export type PitchStatus = "upcoming" | "presenting" | "done";

export type CategoryId = "compellingness" | "funniness" | "hotness";

export type PlayerRole = "voter" | "spectator";

export type Player = {
  id: string;
  name: string;
  role: PlayerRole;
  removed: boolean;
};

export type Pitch = {
  id: string;
  title: string;
  presenterId: string | null;
  status: PitchStatus;
};

export type Score = {
  playerId: string;
  pitchId: string;
  category: CategoryId;
  value: number;
};

export type Ballot = {
  playerId: string;
  order: string[];
  placed: string[];
  submitted: boolean;
};

export type CategoryStats = {
  mean: number | null;
  sd: number | null;
  min: number | null;
  max: number | null;
  p25: number | null;
  p75: number | null;
};

export type DisagreementDirection = "crowd" | "scores";

export type PitchResult = {
  pitchId: string;
  borda: number;
  bordaRank: number;
  firstPlaceCount: number;
  categories: Record<CategoryId, CategoryStats>;
  scoreTotal: number | null;
  scoreRank: number | null;
  disagreement: {
    direction: DisagreementDirection;
    bordaRank: number;
    scoreRank: number;
  } | null;
};

export type Results = {
  countedPlayerIds: string[];
  voidedPlayerIds: string[];
  pitches: PitchResult[];
};

export type MissingScore = { kind: "score"; pitchId: string; category: CategoryId };
export type MissingPlace = { kind: "unplaced"; pitchId: string };
export type MissingItem = MissingScore | MissingPlace;

export type ViewPitch = Pitch & { presenterName: string; position: number };

export type ChipSet = { pitchId: string; chipIds: string[] };

/** Public roster plus the viewer's own notes. Host adds control flags. Results only when closed. */
export type ClientView = {
  phase: Phase;
  rosterLocked: boolean;
  self?: { playerId: string | null; role: PlayerRole | null; isHost: boolean };
  players: Array<{
    id: string;
    name: string;
    role: PlayerRole;
    connected: boolean;
    submitted: boolean;
  }>;
  pitches: ViewPitch[];
  scores?: Score[];
  chips?: ChipSet[];
  ballot?: Ballot;
  missing?: MissingItem[];
  results?: Results;
  host?: {
    canStartPitching: boolean;
    canOpenVoting: boolean;
    canCloseVoting: boolean;
    writes_failed: number;
    reconnects: number;
    connected: number;
  };
};

export type ClientMessageType =
  | "hello"
  | "join"
  | "reclaim"
  | "setScore"
  | "setChips"
  | "movePitch"
  | "placePitch"
  | "submitBallot"
  | "host.addPitch"
  | "host.updatePitch"
  | "host.removePitch"
  | "host.reorderPitches"
  | "host.setStatus"
  | "host.startPitching"
  | "host.openVoting"
  | "host.closeVoting"
  | "host.promote"
  | "host.removePlayer"
  | "host.releaseName";

export type ServerMessageType = "view" | "ack" | "error" | "serverAlert";

export type ClientMessage = { type: ClientMessageType };
export type ServerMessage = { type: ServerMessageType };

export type SessionSnapshot = {
  players: Player[];
  pitches: Pitch[];
  ballots: Ballot[];
  scores: Score[];
};
