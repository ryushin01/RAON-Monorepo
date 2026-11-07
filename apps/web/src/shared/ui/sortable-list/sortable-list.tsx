"use client";

import {
  type Announcements,
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  type ScreenReaderInstructions,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { Notice } from "../notice/notice";
import styles from "./sortable-list.module.scss";

export interface SortableItem {
  id: string;
  /** 스크린 리더에 알릴 이름. 예: 3화 */
  label: string;
  content: ReactNode;
}

interface Props {
  items: SortableItem[];
  /** 놓은 뒤의 새 순서. 실패하면 던져서 원래 순서로 되돌린다. */
  onReorder: (ids: string[]) => Promise<void>;
  /** 목록 전체의 이름. 예: 회차 */
  name: string;
  listClassName?: string;
  itemClassName?: string;
}

const instructions: ScreenReaderInstructions = {
  draggable:
    "옮기려면 스페이스나 엔터를 누른 뒤 위아래 화살표로 자리를 정하고, 다시 스페이스나 엔터를 눌러 놓습니다. Esc를 누르면 취소합니다.",
};

/** 순서를 끌어 놓아 바꾼다. 같은 일을 하는 버튼(위로·아래로)과 함께 두어 끌기가 어려운 사람도 쓸 수 있게 한다. */
export function SortableList({ items, onReorder, name, listClassName, itemClassName }: Props) {
  const dndId = useId();
  const [order, setOrder] = useState(() => items.map((item) => item.id));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  // 서버에서 새 목록을 받으면 그 순서를 따른다. 요청 중에 바뀌었는지 알 수 있게 판(version)을 센다.
  const signature = items.map((item) => item.id).join(",");
  const latest = useRef({ ids: items.map((item) => item.id), version: 0 });
  // biome-ignore lint/correctness/useExhaustiveDependencies: 목록의 순서가 바뀔 때만 맞춘다.
  useEffect(() => {
    const ids = items.map((item) => item.id);
    latest.current = { ids, version: latest.current.version + 1 };
    setOrder(ids);
  }, [signature]);

  const byId = new Map(items.map((item) => [item.id, item]));
  const labelOf = (id: string | number) => byId.get(String(id))?.label ?? "";
  const positionOf = (id: string | number) => order.indexOf(String(id)) + 1;
  const announcements: Announcements = {
    onDragStart: ({ active }) => `${labelOf(active.id)}를 들었습니다. ${positionOf(active.id)}번째 자리입니다.`,
    onDragOver: ({ active, over }) =>
      over ? `${labelOf(active.id)}를 ${positionOf(over.id)}번째 자리 위로 옮겼습니다.` : undefined,
    onDragEnd: ({ active, over }) =>
      over ? `${labelOf(active.id)}를 ${positionOf(over.id)}번째 자리에 놓았습니다.` : "옮기지 않았습니다.",
    onDragCancel: ({ active }) => `${labelOf(active.id)} 옮기기를 취소했습니다.`,
  };

  const sensors = useSensors(
    // 조금 움직여야 끌기가 시작되어, 손잡이를 누르기만 해서는 옮겨지지 않는다(KWCAG 6.5.2).
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = async ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id || busy) return;
    const previous = order;
    const startedAt = latest.current.version;
    const next = arrayMove(order, order.indexOf(String(active.id)), order.indexOf(String(over.id)));
    setOrder(next);
    setError("");
    setBusy(true);
    try {
      await onReorder(next);
    } catch (reason) {
      // 요청하는 사이 새 목록(예: 막 올린 이미지)을 받았으면 그 목록을 지키고, 아니면 원래 순서로 되돌린다.
      setOrder(latest.current.version === startedAt ? previous : latest.current.ids);
      setError(reason instanceof Error ? reason.message : "순서를 바꾸지 못했습니다.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <DndContext
        // 서버와 브라우저가 같은 id를 써야 손잡이의 aria-describedby가 조작 안내를 가리킨다.
        id={dndId}
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
        accessibility={{ announcements, screenReaderInstructions: instructions }}
      >
        <SortableContext items={order} strategy={verticalListSortingStrategy}>
          <ol className={listClassName} aria-label={name} aria-busy={busy}>
            {order.map((id) => {
              const item = byId.get(id);
              return item ? <Row key={id} item={item} className={itemClassName} disabled={busy} /> : null;
            })}
          </ol>
        </SortableContext>
      </DndContext>
      {error && <Notice tone="error">{error}</Notice>}
    </>
  );
}

function Row({ item, className, disabled }: { item: SortableItem; className?: string; disabled: boolean }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled,
  });
  return (
    <li
      ref={setNodeRef}
      className={`${styles.row} ${className ?? ""}`}
      data-dragging={isDragging || undefined}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        className={styles.handle}
        {...attributes}
        {...listeners}
        aria-roledescription="옮길 수 있는 항목"
        aria-label={`끌어서 옮기기: ${item.label}`}
      >
        <span aria-hidden="true">⠿</span>
      </button>
      <div className={styles.content}>{item.content}</div>
    </li>
  );
}
