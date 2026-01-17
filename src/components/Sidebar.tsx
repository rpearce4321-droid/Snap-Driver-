import React from "react";

type SidebarProps = { open: boolean; onToggle: () => void; items: { label: string; href: string }[] };

export default function Sidebar({ open, onToggle, items }: SidebarProps) {
  return (
    <aside className={`transition-all duration-300 ${open ? "w-60" : "w-14"} bg-gray-900/80 border-r border-white/10 h-screen sticky top-0`}>
      <button
        onClick={onToggle}
        className="m-3 rounded-xl px-3 py-2 bg-white/10 hover:bg-white/20 text-sm"
        aria-label="Toggle navigation"
      >
        {open ? "⟨⟨" : "⟩⟩"}
      </button>
      <nav className={`${open ? "px-3" : "px-1"} mt-2 space-y-1`}>
        {items.map((it) => (
          <a key={it.href} href={it.href} className="block rounded-xl px-3 py-2 hover:bg-white/10">
            {open ? it.label : it.label[0]}
          </a>
        ))}
      </nav>
    </aside>
  );
}


