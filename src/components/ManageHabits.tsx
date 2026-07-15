import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { AppState, Habit } from "../lib/types";
import { createHabit, updateHabit, deleteHabit } from "../lib/api";
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export function ManageHabits({ state, pw, onChanged }: { state: AppState; pw: string; onChanged: () => void }) {
  const byId = useMemo(() => new Map(state.habits.map((h) => [h.id, h])), [state.habits]);
  const serverIds = useMemo(
    () => [...state.habits].sort((a, b) => a.sort - b.sort).map((h) => h.id),
    [state.habits]
  );
  // Local order (ids only) for smooth optimistic drag. Rows always render fresh
  // habit data from byId, so field edits never show stale values.
  const [ids, setIds] = useState<number[]>(serverIds);
  const idSig = serverIds.join(",");
  useEffect(() => { setIds(serverIds); }, [idSig]); // eslint-disable-line react-hooks/exhaustive-deps
  const rows = ids.map((id) => byId.get(id)).filter(Boolean) as Habit[];

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  async function patch(id: number, p: Partial<Habit>) { await updateHabit(pw, id, p); onChanged(); }
  async function add() {
    await createHabit(pw, { name: "New habit", kind: "check", emoji: "✅", sort: ids.length });
    onChanged();
  }
  async function remove(id: number) {
    if (confirm("Delete this habit and its history?")) { await deleteHabit(pw, id); onChanged(); }
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldI = ids.indexOf(active.id as number);
    const newI = ids.indexOf(over.id as number);
    if (oldI < 0 || newI < 0) return;
    const next = arrayMove(ids, oldI, newI);
    setIds(next); // optimistic — smooth, no snap-back
    // Persist normalized sort = index for every habit whose position changed.
    Promise.all(
      next.map((id, i) => (byId.get(id)!.sort !== i ? updateHabit(pw, id, { sort: i }) : null))
    ).then(onChanged);
  }

  return (
    <div>
      <p className="mb-3 text-xs text-neutral-500">Drag the handle to reorder. Edits save when you leave a field.</p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {rows.map((h) => (
              <Row key={h.id} habit={h} onPatch={patch} onRemove={remove} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <button onClick={add} className="mt-4 w-full rounded-lg bg-green-600 px-3 py-2 text-sm font-medium">+ Add habit</button>
    </div>
  );
}

function Row({
  habit: h, onPatch, onRemove,
}: {
  habit: Habit;
  onPatch: (id: number, p: Partial<Habit>) => void;
  onRemove: (id: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: h.id });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div
      ref={setNodeRef} style={style}
      className={`flex flex-wrap items-center gap-2 rounded-lg border p-2 ${isDragging ? "border-green-600 bg-neutral-800" : "border-transparent bg-neutral-900"} ${h.archived ? "opacity-50" : ""}`}
    >
      <button
        {...attributes} {...listeners}
        aria-label="Drag to reorder"
        className="cursor-grab touch-none select-none px-1 text-neutral-500 active:cursor-grabbing"
      >⠿</button>
      <input defaultValue={h.emoji} onBlur={(e) => onPatch(h.id, { emoji: e.target.value })} className="w-10 rounded bg-neutral-800 px-2 py-1 text-center" />
      <input defaultValue={h.name} onBlur={(e) => onPatch(h.id, { name: e.target.value })} className="min-w-28 flex-1 rounded bg-neutral-800 px-2 py-1" />
      <input type="color" value={h.color} onChange={(e) => onPatch(h.id, { color: e.target.value })} className="h-8 w-9 rounded bg-neutral-800" />
      <select value={h.kind} onChange={(e) => onPatch(h.id, { kind: e.target.value as Habit["kind"] })} className="rounded bg-neutral-800 px-2 py-1">
        <option value="check">check</option><option value="number">number</option>
      </select>
      {h.kind === "number" && (
        <>
          <input type="number" defaultValue={h.goal ?? 0} onBlur={(e) => onPatch(h.id, { goal: Number(e.target.value) })} className="w-16 rounded bg-neutral-800 px-2 py-1" />
          <select value={h.goal_dir ?? "atLeast"} onChange={(e) => onPatch(h.id, { goal_dir: e.target.value as Habit["goal_dir"] })} className="rounded bg-neutral-800 px-2 py-1">
            <option value="atLeast">≥</option><option value="atMost">≤</option>
          </select>
          <input defaultValue={h.unit} placeholder="unit" onBlur={(e) => onPatch(h.id, { unit: e.target.value })} className="w-16 rounded bg-neutral-800 px-2 py-1" />
        </>
      )}
      <button onClick={() => onPatch(h.id, { archived: h.archived ? 0 : 1 })} className="px-1.5 text-xs text-amber-400">{h.archived ? "unarchive" : "archive"}</button>
      <button onClick={() => onRemove(h.id)} className="px-1.5 text-xs text-red-400">delete</button>
    </div>
  );
}
