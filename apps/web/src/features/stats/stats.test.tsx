import { DEFAULT_USER_SETTINGS, type Exercise, type WorkoutSet } from "@fitness/shared";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExerciseSession, PrEvent, Training, WorkoutView } from "@/lib/training";
import { Sparkline } from "@/ui/Sparkline";
import { ConsistencyGrid } from "./ConsistencyGrid";
import { StatsScreen } from "./StatsScreen";

const navigate = vi.fn();
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }));

const mock = vi.hoisted(() => ({ training: null as unknown, goal: 2 }));
vi.mock("@/data/hooks", () => ({
  useTraining: () => mock.training,
  useCatalog: () => ({
    loaded: true, list: [], hidden: new Set(),
    byId: new Map([["bench", { id: "bench", name: "Bench Press", primaryMuscle: "chest" }], ["squat", { id: "squat", name: "Squat", primaryMuscle: "quads" }]]),
  }),
  useRuns: () => [],
  useSettings: () => ({ ...DEFAULT_USER_SETTINGS, language: "en", weeklyGoal: mock.goal, weekStart: "monday", weightUnit: "kg" }),
  muscleGroup: (e: Pick<Exercise, "primaryMuscle">) => (e.primaryMuscle === "chest" ? "Chest" : "Legs"),
}));

const set = (weightKg: number, reps: number) => ({ weightKg, reps, setType: "normal", completedAt: "x" }) as unknown as WorkoutSet;
function workout(day: string, exs: Array<[string, WorkoutSet[]]>): WorkoutView {
  const start = new Date(`${day}T18:00:00`);
  return {
    activity: { id: day } as WorkoutView["activity"], start, end: start, durationMin: 60, prCount: 0, setCount: 0,
    exercises: exs.map(([exerciseId, sets]) => ({ ae: { exerciseId } as WorkoutView["exercises"][number]["ae"], sets, pr: null })),
  };
}

function training(workouts: WorkoutView[], loaded = true): Training & { loaded: boolean } {
  const sessionsByExercise = new Map<string, ExerciseSession[]>();
  for (const w of [...workouts].reverse()) {
    for (const e of w.exercises) {
      const list = sessionsByExercise.get(e.ae.exerciseId) ?? [];
      list.push({ activityId: w.activity.id, aeId: w.activity.id + e.ae.exerciseId, workoutName: "W", date: w.start, sets: e.sets, heaviest: null, bestReps: null });
      sessionsByExercise.set(e.ae.exerciseId, list);
    }
  }
  const prEvents: PrEvent[] = [{ exerciseId: "bench", activityId: "2026-10-02", workoutName: "W", date: new Date("2026-10-02T18:00:00"), value: 90, previous: 85 }];
  return { workouts, byId: new Map(), sessionsByExercise, prEvents, loaded };
}

// Newest first, like buildTraining.
const WORKOUTS = [
  workout("2026-10-02", [["bench", [set(90, 3), set(80, 8)]], ["squat", [set(120, 5)]]]),
  workout("2026-09-30", [["bench", [set(85, 5)]]]),
  workout("2026-09-03", [["bench", [set(80, 5)]]]),
  workout("2026-08-20", [["squat", [set(100, 5)]]]),
];

describe("StatsScreen", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-04T12:00:00"));
    sessionStorage.clear();
    navigate.mockClear();
    mock.goal = 2;
  });
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  it("shows a loading placeholder until the data is there", () => {
    mock.training = training([], false);
    render(<StatsScreen />);
    expect(screen.getByRole("status").textContent).toBe("Loading statistics…");
  });

  it("shows a friendly empty state without any workouts", () => {
    mock.training = training([]);
    render(<StatsScreen />);
    expect(screen.getByText("No workouts yet.")).toBeTruthy();
    expect(screen.queryByRole("tablist")).toBeNull();
  });

  it("month: totals, change vs the same days last month, consistency, muscle groups, e1RM, PRs", () => {
    mock.training = training(WORKOUTS);
    const { container } = render(<StatsScreen />);
    const totals = container.querySelector(".stats")!;
    expect(totals.textContent).toContain("1Workouts"); // 30.09. is September → not in October
    // vs 1–4 Sep (one workout, 1 set): workouts equal, sets +2, read out in words for VoiceOver.
    expect(within(totals as HTMLElement).getAllByText("same as the same stretch before")).toHaveLength(2); // workouts + time
    expect(within(totals as HTMLElement).getByText("2 more than the same stretch before")).toBeTruthy();
    expect(totals.textContent).toContain("+2");
    expect(screen.getByText("Changes vs the same days last month")).toBeTruthy();

    // Consistency: 12 week buttons, current week selected (2 workouts = goal 2 reached).
    const weeks = screen.getAllByRole("button", { pressed: true });
    expect(weeks).toHaveLength(1);
    expect(weeks[0]!.getAttribute("aria-label")).toBe("This week: 2 workouts, goal reached");
    expect(container.querySelectorAll(".cg-col")).toHaveLength(12);

    // Muscle groups: tap Chest to see its exercises.
    const chest = screen.getByRole("button", { name: /^Chest:/ });
    expect(chest.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(chest);
    expect(chest.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(within(container.querySelector(".hb-drill") as HTMLElement).getByText("Bench Press"));
    expect(navigate).toHaveBeenCalledWith({ to: "/exercises/$exerciseId", params: { exerciseId: "bench" } });

    // e1RM: best of 90×3 (99) and 80×8 (101.3) → 101, vs 80×5 (93.3) on 3 Sep → +8.
    expect(screen.getByLabelText("Estimated 1RM 101 kg, +8 kg vs before")).toBeTruthy();
    expect(screen.getByText("New PRs")).toBeTruthy();
    expect(screen.getByText("90 kg")).toBeTruthy();
  });

  it("switching to All hides the comparison and remembers the period for this session", () => {
    mock.training = training(WORKOUTS);
    render(<StatsScreen />);
    act(() => { screen.getByRole("tab", { name: "All" }).click(); });
    expect(screen.getByRole("tab", { name: "All" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.queryByText(/Changes vs/)).toBeNull();
    expect(sessionStorage.getItem("stats.period")).toBe("all");
    cleanup();
    render(<StatsScreen />);
    expect(screen.getByRole("tab", { name: "All" }).getAttribute("aria-selected")).toBe("true");
  });

  it("week without workouts yet: says so but keeps the consistency card", () => {
    mock.training = training(WORKOUTS.slice(2));
    render(<StatsScreen />);
    act(() => { screen.getByRole("tab", { name: "Week" }).click(); });
    expect(screen.getByText("No workouts in this period yet.")).toBeTruthy();
    expect(screen.getByText("Consistency")).toBeTruthy();
  });
});

describe("ConsistencyGrid", () => {
  it("one button per week, filled days, goal bar, selection callback", () => {
    const days = (counts: number[]) => counts.map((count, i) => ({ date: new Date(2026, 8, i + 1), count, future: false }));
    const weeks = [
      { start: new Date(2026, 8, 1), count: 1, days: days([1, 0, 0, 0, 0, 0, 0]) },
      { start: new Date(2026, 8, 8), count: 3, days: days([1, 0, 2, 0, 0, 0, 0]) },
    ];
    const onSelect = vi.fn();
    const { container } = render(
      <ConsistencyGrid weeks={weeks} goal={2} selected={1} onSelect={onSelect} dayLabels={["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]}
        weekLabel={() => "x"} ariaFor={(w, r) => `${w.count}${r ? " ok" : ""}`} label="grid" />,
    );
    const cols = screen.getAllByRole("button");
    expect(cols.map((c) => c.getAttribute("aria-label"))).toEqual(["1", "3 ok"]);
    expect(container.querySelectorAll(".cg-d.l1")).toHaveLength(2);
    expect(container.querySelectorAll(".cg-d.l2")).toHaveLength(1);
    expect(container.querySelectorAll(".cg-goal.ok")).toHaveLength(1);
    fireEvent.click(cols[0]!);
    expect(onSelect).toHaveBeenCalledWith(0);
    cleanup();
  });
});

describe("Sparkline", () => {
  it("draws a line with a dot on the latest value; nothing for fewer than two values", () => {
    const { container } = render(<Sparkline values={[90, 95, 93, 101]} label="trend" />);
    expect(container.querySelector("polyline")!.getAttribute("points")!.split(" ")).toHaveLength(4);
    expect(container.querySelector("circle")).not.toBeNull();
    cleanup();
    const empty = render(<Sparkline values={[90]} label="trend" />);
    expect(empty.container.innerHTML).toBe("");
    cleanup();
  });
});
