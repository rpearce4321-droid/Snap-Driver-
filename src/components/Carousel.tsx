import React from "react";

type Card = { id: string; title: string; subtitle?: string };

export default function Carousel({ items, title }: { items: Card[]; title: string }) {
  return (
    <section className="mt-6">
      <h3 className="text-lg font-semibold mb-3">{title}</h3>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {items.slice(0, 9).map((it) => (
          <div key={it.id} className="min-w-[220px] rounded-2xl bg-white/5 border border-white/10 p-4">
            <div className="font-medium">{it.title}</div>
            {it.subtitle && <div className="text-sm text-white/70 mt-1">{it.subtitle}</div>}
          </div>
        ))}
      </div>
    </section>
  );
}


