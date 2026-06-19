// Mock data for UI development
// This will be replaced with real API data later.

export interface MockTile {
  id: string;
  title: string;
  nextAction: string | null;
  status: "active" | "scheduled" | "done";
}

export interface MockTimelineSegment {
  time: string;
  type: "work" | "break" | "fixed";
  title: string;
  status: "done" | "active" | "scheduled";
  duration?: number; // minutes
}

export interface MockPrompt {
  type: "start" | "end";
  tile: MockTile;
  actions: string[];
  reason?: string;
}

// Active tile currently running
export const mockActiveTile: MockTile = {
  id: "1",
  title: "parser修正",
  nextAction: "テストケース追加",
  status: "active",
};

// Next tile system is suggesting
export const mockNextTile: MockTile = {
  id: "2",
  title: "デザイン実装",
  nextAction: "コンポーネント作成",
  status: "scheduled",
};

// Timeline for today
export const mockTimeline: MockTimelineSegment[] = [
  {
    time: "09:00",
    type: "work",
    title: "parser修正",
    status: "done",
    duration: 120, // 2 hours
  },
  {
    time: "11:00",
    type: "break",
    title: "休憩",
    status: "done",
    duration: 15,
  },
  {
    time: "11:15",
    type: "work",
    title: "テスト修正",
    status: "done",
    duration: 45,
  },
  {
    time: "12:00",
    type: "break",
    title: "昼食",
    status: "done",
    duration: 60,
  },
  {
    time: "13:00",
    type: "work",
    title: "parser修正 (継続)",
    status: "active",
    duration: 60,
  },
  {
    time: "14:00",
    type: "fixed",
    title: "チーム会議",
    status: "scheduled",
    duration: 60,
  },
  {
    time: "15:00",
    type: "break",
    title: "休憩",
    status: "scheduled",
    duration: 15,
  },
  {
    time: "15:15",
    type: "work",
    title: "デザイン実装",
    status: "scheduled",
    duration: 120,
  },
];

// All tiles
export const mockTiles: MockTile[] = [
  mockActiveTile,
  mockNextTile,
  {
    id: "3",
    title: "ドキュメント作成",
    nextAction: "README更新",
    status: "scheduled",
  },
  {
    id: "4",
    title: "API実装",
    nextAction: "エンドポイント追加",
    status: "scheduled",
  },
  {
    id: "5",
    title: "テスト追加",
    nextAction: "E2Eテスト作成",
    status: "scheduled",
  },
];

// Pending prompt (null if no prompt)
export const mockPrompt: MockPrompt | null = null;
// Example start prompt:
// {
//   type: 'start',
//   tile: mockNextTile,
//   actions: ['開始', '先送り'],
//   reason: '締切まであと2時間',
// }
// Example end prompt:
// {
//   type: 'end',
//   tile: mockActiveTile,
//   actions: ['次へ', '延長', '先送り'],
// }

// Execution state
export interface MockExecutionState {
  activeTile: MockTile | null;
  phaseStartedAt: Date | null;
  phaseEndsAt: Date | null;
  elapsedSeconds: number;
  totalSeconds: number;
  progress: number; // 0-1
}

export const mockExecutionState: MockExecutionState = {
  activeTile: mockActiveTile,
  phaseStartedAt: new Date(Date.now() - 25 * 60 * 1000), // Started 25 min ago
  phaseEndsAt: new Date(Date.now() + 35 * 60 * 1000), // Ends in 35 min
  elapsedSeconds: 1500, // 25 minutes
  totalSeconds: 3600, // 60 minutes total
  progress: 0.42, // 42%
};
