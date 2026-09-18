export interface HistoryState<T> {
  items: T[];
  index: number;
  limit: number;
}

export function createHistory<T>(initial: T, limit = 100): HistoryState<T> {
  return { items: [initial], index: 0, limit: Math.max(1, limit) };
}

export function pushHistory<T>(state: HistoryState<T>, next: T): HistoryState<T> {
  const trimmed = state.items.slice(0, state.index + 1);
  const items = [...trimmed, next];
  if (items.length > state.limit) {
    items.splice(0, items.length - state.limit);
  }
  return { items, index: items.length - 1, limit: state.limit };
}

export function undoHistory<T>(state: HistoryState<T>): { state: HistoryState<T>; value: T | null } {
  if (state.index <= 0) return { state, value: null };
  const index = state.index - 1;
  return { state: { ...state, index }, value: state.items[index] };
}

export function redoHistory<T>(state: HistoryState<T>): { state: HistoryState<T>; value: T | null } {
  if (state.index >= state.items.length - 1) return { state, value: null };
  const index = state.index + 1;
  return { state: { ...state, index }, value: state.items[index] };
}

export function canUndo<T>(state: HistoryState<T>): boolean {
  return state.index > 0;
}

export function canRedo<T>(state: HistoryState<T>): boolean {
  return state.index < state.items.length - 1;
}