export type HabitKind = 'check' | 'number';
export type GoalDir = 'atLeast' | 'atMost';

export interface Habit {
  id: number;
  name: string;
  emoji: string;
  color: string;
  kind: HabitKind;
  goal: number | null;
  goal_dir: GoalDir | null;
  unit: string;
  sort: number;
  archived: 0 | 1;
  created_at: string;
}

export interface Entry {
  habit_id: number;
  date: string;
  value: number | null;
  done: 0 | 1;
}

export interface Settings {
  title: string;
  sprint_on: 0 | 1;
  sprint_start: string | null;
  sprint_len_days: number;
  has_password: boolean;
}

export interface AppState {
  habits: Habit[];
  entries: Entry[];
  settings: Settings;
}
