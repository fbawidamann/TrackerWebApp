import { createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { ExerciseDetailScreen } from "@/features/exercises/ExerciseDetailScreen";
import { ExercisesScreen } from "@/features/exercises/ExercisesScreen";
import { CalendarScreen } from "@/features/history/CalendarScreen";
import { HistoryScreen } from "@/features/history/HistoryScreen";
import { WorkoutDetailScreen } from "@/features/history/WorkoutDetailScreen";
import { WorkoutEditor } from "@/features/history/WorkoutEditor";
import { HomeScreen } from "@/features/home/HomeScreen";
import { ProfileScreen } from "@/features/profile/ProfileScreen";
import { UsersScreen } from "@/features/admin/UsersScreen";
import { RoutineEditor } from "@/features/routines/RoutineEditor";
import { RoutinesScreen } from "@/features/routines/RoutinesScreen";
import { RunDetailScreen } from "@/features/running/RunDetailScreen";
import { RunEditor } from "@/features/running/RunEditor";
import { RunningScreen } from "@/features/running/RunningScreen";
import { SummaryScreen } from "@/features/workout/SummaryScreen";
import { WorkoutScreen } from "@/features/workout/WorkoutScreen";
import { useT } from "@/i18n";
import { Layout } from "./Layout";

function NotFound() {
  return <div className="page"><p className="muted">{useT().common.pageNotFound}</p></div>;
}

const root = createRootRoute({ component: Layout, notFoundComponent: NotFound });
const home = createRoute({ getParentRoute: () => root, path: "/", component: HomeScreen });
const workout = createRoute({ getParentRoute: () => root, path: "/workout", component: WorkoutScreen });
const summary = createRoute({ getParentRoute: () => root, path: "/workout/done/$activityId", component: SummaryScreen });
const exercises = createRoute({ getParentRoute: () => root, path: "/exercises", component: ExercisesScreen });
const exerciseDetail = createRoute({ getParentRoute: () => root, path: "/exercises/$exerciseId", component: ExerciseDetailScreen });
const history = createRoute({ getParentRoute: () => root, path: "/history", component: HistoryScreen });
const calendar = createRoute({ getParentRoute: () => root, path: "/history/calendar", component: CalendarScreen });
const logPast = createRoute({ getParentRoute: () => root, path: "/history/new", component: WorkoutEditor });
const workoutDetail = createRoute({ getParentRoute: () => root, path: "/history/$activityId", component: WorkoutDetailScreen });
const workoutEdit = createRoute({ getParentRoute: () => root, path: "/history/$activityId/edit", component: WorkoutEditor });
const routines = createRoute({ getParentRoute: () => root, path: "/routines", component: RoutinesScreen });
const routineNew = createRoute({ getParentRoute: () => root, path: "/routines/new", component: RoutineEditor });
const routineEdit = createRoute({ getParentRoute: () => root, path: "/routines/$routineId/edit", component: RoutineEditor });
const running = createRoute({ getParentRoute: () => root, path: "/running", component: RunningScreen });
const runNew = createRoute({ getParentRoute: () => root, path: "/running/new", component: RunEditor });
const runDetail = createRoute({ getParentRoute: () => root, path: "/running/$activityId", component: RunDetailScreen });
const runEdit = createRoute({ getParentRoute: () => root, path: "/running/$activityId/edit", component: RunEditor });
const profile = createRoute({ getParentRoute: () => root, path: "/profile", component: ProfileScreen });
const users = createRoute({ getParentRoute: () => root, path: "/profile/users", component: UsersScreen });

const routeTree = root.addChildren([
  home, workout, summary, exercises, exerciseDetail, history, calendar, logPast, workoutDetail, workoutEdit, routines, routineNew, routineEdit,
  running, runNew, runDetail, runEdit, profile, users,
]);

export const router = createRouter({ routeTree, defaultPreload: false });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
