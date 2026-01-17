// src/components/HierarchyCanvas.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type HierarchyItem = {
  id: string;
  name: string;
  title?: string;
  meta?: string;
  photoUrl?: string;
};

export type HierarchyNode = {
  id: string;
  x: number;
  y: number;
  parentId?: string;
};

type HierarchyCanvasProps = {
  owner: HierarchyItem;
  items: HierarchyItem[];
  nodes: HierarchyNode[];
  onNodesChange?: (nodes: HierarchyNode[]) => void;
  readOnly?: boolean;
  showList?: boolean;
  emptyHint?: string;
};

const CARD_WIDTH = 240;
const CARD_HEIGHT = 72;
const GRID_SIZE = 32;
const TOP_PADDING = 120;
const BOARD_PADDING = 260;
const MIN_BOARD_WIDTH = 1100;
const MIN_BOARD_HEIGHT = 620;

export default function HierarchyCanvas({
  owner,
  items,
  nodes,
  onNodesChange,
  readOnly = false,
  showList = true,
  emptyHint,
}: HierarchyCanvasProps) {
  const [linkingFromId, setLinkingFromId] = useState<string | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const panRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    startScrollLeft: number;
    startScrollTop: number;
  }>({ active: false, startX: 0, startY: 0, startScrollLeft: 0, startScrollTop: 0 });
  const filteredNodes = useMemo(
    () => nodes.filter((n) => n.id !== owner.id),
    [nodes, owner.id]
  );
  const nodeById = useMemo(
    () => new Map(filteredNodes.map((n) => [n.id, n])),
    [filteredNodes]
  );

  const updateNodes = (next: HierarchyNode[]) => {
    if (readOnly || !onNodesChange) return;
    const cleaned = next.filter((n) => n.id !== owner.id);
    onNodesChange(cleaned);
  };

  const snap = (value: number) =>
    Math.round(value / GRID_SIZE) * GRID_SIZE;

  const clampNode = (x: number, y: number) => ({
    x: Math.max(0, snap(x)),
    y: Math.max(TOP_PADDING, snap(y)),
  });

  useEffect(() => {
    if (!isPanning) return;
    const handleMove = (e: MouseEvent) => {
      if (!panRef.current.active) return;
      const el = canvasRef.current;
      if (!el) return;
      const dx = e.clientX - panRef.current.startX;
      const dy = e.clientY - panRef.current.startY;
      el.scrollLeft = panRef.current.startScrollLeft - dx;
      el.scrollTop = panRef.current.startScrollTop - dy;
    };
    const handleUp = () => {
      panRef.current.active = false;
      setIsPanning(false);
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [isPanning]);

  const handleClearLink = (id: string) => {
    if (readOnly) return;
    updateNodes(
      nodes.map((n) => (n.id === id ? { ...n, parentId: undefined } : n))
    );
  };

  const handleLinkStart = (id: string) => {
    if (readOnly) return;
    setLinkingFromId((prev) => (prev === id ? null : id));
  };

  const handleLinkTarget = (id: string) => {
    if (readOnly || !linkingFromId) return;
    if (linkingFromId === id) {
      setLinkingFromId(null);
      return;
    }
    updateNodes(
      nodes.map((n) =>
        n.id === id ? { ...n, parentId: linkingFromId } : n
      )
    );
    setLinkingFromId(null);
  };

  const handleDrop: React.DragEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    if (readOnly) return;
    const id = e.dataTransfer.getData("application/x-hierarchy-id");
    if (!id) return;

    const offsetRaw = e.dataTransfer.getData("application/x-hierarchy-offset");
    const [offsetX, offsetY] = offsetRaw
      ? offsetRaw.split(",").map((v) => Number(v) || 0)
      : [0, 0];

    const rect = canvasRef.current?.getBoundingClientRect();
    const scrollLeft = canvasRef.current?.scrollLeft ?? 0;
    const scrollTop = canvasRef.current?.scrollTop ?? 0;
    const x = rect ? e.clientX - rect.left + scrollLeft - offsetX : 0;
    const y = rect ? e.clientY - rect.top + scrollTop - offsetY : 0;

    const clamped = clampNode(x, y);
    const prev = nodeById.get(id);

    const next = nodeById.has(id)
      ? nodes.map((n) =>
          n.id === id ? { ...n, ...clamped, parentId: prev?.parentId } : n
        )
      : [...nodes, { id, ...clamped }];

    updateNodes(next);
  };

  const handleDragStart = (
    e: React.DragEvent<HTMLButtonElement | HTMLDivElement>,
    id: string
  ) => {
    if (readOnly) return;
    const offsetX = (e.nativeEvent as DragEvent).offsetX ?? 0;
    const offsetY = (e.nativeEvent as DragEvent).offsetY ?? 0;
    e.dataTransfer.setData("application/x-hierarchy-id", id);
    e.dataTransfer.setData(
      "application/x-hierarchy-offset",
      `${offsetX},${offsetY}`
    );
    e.dataTransfer.effectAllowed = "move";
  };

  const handleRemove = (id: string) => {
    if (readOnly) return;
    const next = nodes
      .filter((n) => n.id !== id)
      .map((n) => (n.parentId === id ? { ...n, parentId: undefined } : n));
    updateNodes(next);
  };

  const renderCard = (
    item: HierarchyItem,
    placed: boolean,
    opts?: { fixedWidth?: boolean; highlight?: boolean }
  ) => (
    <div
      data-hierarchy-card="true"
      className={[
        "rounded-xl border px-3 py-2 text-xs flex items-center gap-3",
        opts?.fixedWidth ? "w-60" : "w-full",
        placed
          ? "border-emerald-500/40 bg-emerald-500/10"
          : "border-slate-700 bg-slate-900/70",
        opts?.highlight ? "ring-2 ring-amber-400/60" : "",
      ].join(" ")}
    >
      <div className="h-10 w-10 rounded-full bg-slate-800 border border-slate-700 overflow-hidden shrink-0">
        {item.photoUrl ? (
          <img src={item.photoUrl} alt={item.name} className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-[10px] text-slate-400">
            {item.name.slice(0, 1).toUpperCase()}
          </div>
        )}
      </div>
      <div className="min-w-0">
        <div className="font-semibold text-slate-100 truncate">{item.name}</div>
        {item.title && <div className="text-[11px] text-slate-400 truncate">{item.title}</div>}
        {item.meta && <div className="text-[10px] text-slate-500 truncate">{item.meta}</div>}
      </div>
    </div>
  );

  const placedNodes = filteredNodes;
  const maxX = placedNodes.reduce((acc, n) => Math.max(acc, n.x), 0);
  const maxY = placedNodes.reduce((acc, n) => Math.max(acc, n.y), TOP_PADDING);

  const boardWidth = Math.max(
    MIN_BOARD_WIDTH,
    maxX + CARD_WIDTH + BOARD_PADDING
  );
  const boardHeight = Math.max(
    MIN_BOARD_HEIGHT,
    maxY + CARD_HEIGHT + BOARD_PADDING
  );

  const centerCanvas = useCallback(() => {
    const el = canvasRef.current;
    if (!el) return;
    const targetLeft = Math.max(0, (boardWidth - el.clientWidth) / 2);
    const targetTop = Math.max(0, (boardHeight - el.clientHeight) / 2);
    el.scrollLeft = targetLeft;
    el.scrollTop = targetTop;
  }, [boardHeight, boardWidth]);

  useEffect(() => {
    centerCanvas();
  }, [centerCanvas]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleResize = () => centerCanvas();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [centerCanvas]);

  const ownerX = Math.max(0, Math.round(boardWidth / 2 - CARD_WIDTH / 2));
  const ownerY = 24;

  const nodePositions = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    for (const n of placedNodes) {
      map.set(n.id, {
        x: Math.max(0, n.x),
        y: Math.max(TOP_PADDING, n.y),
      });
    }
    return map;
  }, [placedNodes]);

  const edges = useMemo(() => {
    return placedNodes
      .filter((n) => n.parentId)
      .map((n) => ({
        id: `${n.parentId}-${n.id}`,
        fromId: n.parentId as string,
        toId: n.id,
      }))
      .filter((edge) => edge.fromId === owner.id || nodePositions.has(edge.fromId));
  }, [placedNodes, nodePositions, owner.id]);

  const layoutClass = showList
    ? "grid gap-4 md:grid-cols-[minmax(0,260px)_minmax(0,1fr)]"
    : "grid gap-4";

  return (
    <div className={layoutClass}>
      {showList && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3 space-y-2 max-h-[520px] overflow-y-auto">
          <div className="text-xs uppercase tracking-wide text-slate-400">
            Profiles
          </div>
          {items.length === 0 ? (
            <div className="text-xs text-slate-500">
              {emptyHint || "No profiles yet."}
            </div>
          ) : (
            items.map((item) => {
              const placed = nodeById.has(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  draggable={!readOnly}
                  onDragStart={(e) => handleDragStart(e, item.id)}
                  className="w-full text-left"
                >
                  {renderCard(item, placed)}
                </button>
              );
            })
          )}
        </div>
      )}

      <div
        ref={canvasRef}
        className={[
          "relative rounded-2xl border border-slate-800 bg-slate-950/60 min-h-[560px] md:min-h-[640px] overflow-auto sd-scrollbar-hide",
          isPanning ? "cursor-grabbing select-none" : "cursor-grab",
        ].join(" ")}
        onMouseDown={(e) => {
          if (e.button !== 0) return;
          const target = e.target as HTMLElement | null;
          if (!target) return;
          if (target.closest('[data-hierarchy-card="true"]')) return;
          if (target.closest("button")) return;

          panRef.current.active = true;
          panRef.current.startX = e.clientX;
          panRef.current.startY = e.clientY;
          panRef.current.startScrollLeft = canvasRef.current?.scrollLeft ?? 0;
          panRef.current.startScrollTop = canvasRef.current?.scrollTop ?? 0;
          setIsPanning(true);
        }}
        onDragOver={(e) => {
          if (readOnly) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
        }}
        onDrop={handleDrop}
      >
        <div
          className="relative"
          style={{
            minWidth: boardWidth,
            minHeight: boardHeight,
            backgroundImage:
              "linear-gradient(rgba(148,163,184,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.08) 1px, transparent 1px)",
            backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px`,
            backgroundPosition: "0 0",
          }}
          onClick={() => {
            if (linkingFromId) setLinkingFromId(null);
          }}
        >
          <svg
            className="absolute inset-0 pointer-events-none"
            width={boardWidth}
            height={boardHeight}
          >
            {edges.map((edge) => {
              const childPos = nodePositions.get(edge.toId);
              if (!childPos) return null;
              const parentPos =
                edge.fromId === owner.id
                  ? { x: ownerX, y: ownerY }
                  : nodePositions.get(edge.fromId);
              if (!parentPos) return null;

              const startX = parentPos.x + CARD_WIDTH / 2;
              const startY = parentPos.y + CARD_HEIGHT;
              const endX = childPos.x + CARD_WIDTH / 2;
              const endY = childPos.y;
              const midY = startY + (endY - startY) * 0.5;

              return (
                <path
                  key={edge.id}
                  d={`M ${startX} ${startY} C ${startX} ${midY} ${endX} ${midY} ${endX} ${endY}`}
                  stroke="rgba(148, 163, 184, 0.7)"
                  strokeWidth="1.5"
                  fill="none"
                />
              );
            })}
          </svg>

          <div
            className="absolute"
            style={{ left: ownerX, top: ownerY }}
          >
            <div className="relative">
              {renderCard(owner, true, {
                fixedWidth: true,
                highlight: linkingFromId === owner.id,
              })}
              {!readOnly && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleLinkStart(owner.id);
                  }}
                  className="absolute -top-2 -right-2 h-6 px-2 rounded-full bg-slate-900 border border-slate-700 text-[10px] text-slate-300 hover:bg-slate-800"
                  title="Link this as a parent"
                >
                  Link
                </button>
              )}
            </div>
          </div>

          {placedNodes.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-500">
              {readOnly ? "No hierarchy has been built yet." : "Drag profiles here to build your tree."}
            </div>
          ) : (
            placedNodes.map((node) => {
              const item = items.find((i) => i.id === node.id);
              if (!item) return null;
              const position = nodePositions.get(node.id) ?? { x: node.x, y: node.y };
              const hasParent = !!node.parentId;

              return (
                <div
                  key={node.id}
                  draggable={!readOnly}
                  onDragStart={(e) => handleDragStart(e, node.id)}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleLinkTarget(node.id);
                  }}
                  style={{ left: position.x, top: position.y }}
                  className="absolute"
                >
                  <div className="relative">
                    {renderCard(item, true, {
                      fixedWidth: true,
                      highlight: linkingFromId === node.id,
                    })}
                    {!readOnly && (
                      <div className="absolute -top-2 -right-2 flex items-center gap-1">
                        {hasParent && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleClearLink(node.id);
                            }}
                            className="h-6 px-2 rounded-full bg-slate-900 border border-slate-700 text-[10px] text-slate-300 hover:bg-slate-800"
                            title="Clear parent link"
                          >
                            Unlink
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleLinkStart(node.id);
                          }}
                          className="h-6 px-2 rounded-full bg-slate-900 border border-slate-700 text-[10px] text-slate-300 hover:bg-slate-800"
                          title="Link this as a parent"
                        >
                          Link
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemove(node.id);
                          }}
                          className="h-6 w-6 rounded-full bg-slate-900 border border-slate-700 text-[10px] text-slate-300 hover:bg-slate-800"
                          title="Remove from tree"
                        >
                          x
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
