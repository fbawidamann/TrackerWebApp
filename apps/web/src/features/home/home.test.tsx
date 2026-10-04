import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RoutineView } from "@/data/hooks";
import { weekDays } from "@/lib/home";
import { UpNextCard } from "./UpNextCard";
import { WeekCard } from "./WeekCard";

afterEach(cleanup);

const now = new Date("2026-09-30T12:00:00"); // Wednesday
const days = weekDays(new Date("2026-09-28T00:00:00"), [{ start: new Date("2026-09-28T18:00:00") }, { start: new Date("2026-09-30T07:00:00") }],
  [{ start: new Date("2026-09-29T06:30:00") }], now);

describe("WeekCard", () => {
  it("shows the goal, 7 days with gym/today state and a run marker; tap opens the goal sheet", () => {
    const onEdit = vi.fn();
    const { container } = render(<WeekCard days={days} done={2} goal={3} runs={1} streak={0} loading={false} onEditGoal={onEdit} />);
    expect(screen.getByText("1 to go")).toBeTruthy();
    const items = container.querySelectorAll("li.day");
    expect(items).toHaveLength(7);
    expect([...items].map((li) => li.classList.contains("gym"))).toEqual([true, false, true, false, false, false, false]);
    expect(items[2]!.getAttribute("aria-current")).toBe("date");
    expect(items[1]!.querySelector(".day-run svg")).not.toBeNull();
    expect(container.querySelectorAll(".segs i.on")).toHaveLength(2);
    expect(screen.getByText("Today, Wednesday: 1 workout")).toBeTruthy();
    expect(screen.getByText("Tuesday: 1 run")).toBeTruthy();
    expect(container.querySelector(".week-streak")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /This week: 2 of 3 workouts, 1 run/ }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it("goal reached + streak line from 2 weeks", () => {
    render(<WeekCard days={days} done={3} goal={3} runs={0} streak={4} loading={false} onEditGoal={() => {}} />);
    expect(screen.getByText("goal reached")).toBeTruthy();
    expect(screen.getByText("Goal reached 4 weeks in a row")).toBeTruthy();
  });
});

describe("UpNextCard", () => {
  const view = { routine: { id: "r1", name: "Pull Day", position: 0 }, items: [{ exerciseId: "row" }, { exerciseId: "curl" }], setCount: 8 } as unknown as RoutineView;
  it("shows the routine with muscle groups; text opens the preview, Start starts it", () => {
    const onOpen = vi.fn();
    const onStart = vi.fn();
    render(<UpNextCard view={view} groups={["Back", "Arms"]} lastDone={undefined} onOpen={onOpen} onStart={onStart} />);
    expect(screen.getByText("Pull Day")).toBeTruthy();
    expect(screen.getByText("Back · Arms · never done")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Start Pull Day" }));
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Pull Day"));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("falls back to the exercise count without muscle groups", () => {
    render(<UpNextCard view={view} groups={[]} lastDone={undefined} onOpen={() => {}} onStart={() => {}} />);
    expect(screen.getByText("2 exercises · never done")).toBeTruthy();
  });
});
