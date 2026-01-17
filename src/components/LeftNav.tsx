import React, { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";

/** LeftNav with collapsible categories, real NavLinks, Edit deep-links,
 *  and softened edges to blend with the bluish-orange background.
 */
type Cat = {
  id: "admin" | "seeker" | "retainer";
  label: string;
  defaultOpen?: boolean;
  links: { to: string; label: string }[];
  editTo: string;
};

export default function LeftNav() {
  const [open, setOpen] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    admin: true,
    seeker: true,
    retainer: true,
  });

  const navigate = useNavigate();

  const cats: Cat[] = [
    { id: "admin", label: "Admin", defaultOpen: true, links: [{ to: "/admin", label: "Dashboard" }], editTo: "/admin#edit" },
    { id: "seeker", label: "Seeker", links: [{ to: "/seeker", label: "Dashboard" }], editTo: "/seeker#edit" },
    { id: "retainer", label: "Retainer", links: [{ to: "/retainer", label: "Dashboard" }], editTo: "/retainer#edit" },
  ];

  // softened look to match new layout background
  const aside: React.CSSProperties = {
    height: "100vh",
    position: "sticky",
    top: 0,
    padding: 12,
    width: open ? 260 : 64,
    transition: "width .25s ease",
    background: "linear-gradient(180deg, rgba(15,23,42,0.95) 0%, rgba(43,27,14,0.9) 100%)",
    borderRight: "1px solid rgba(255,255,255,0.06)",
    boxShadow: "0 0 16px rgba(0,0,0,0.35)",
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
  };
  const section: React.CSSProperties = {
    background: "rgba(18,18,18,0.75)",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 12,
    padding: 8,
  };
  const btn: React.CSSProperties = {
    background: "rgba(26,26,26,0.9)",
    color: "#eee",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 12,
    padding: "8px 10px",
    cursor: "pointer",
  };
  const linkBase: React.CSSProperties = {
    display: "block",
    textDecoration: "none",
    color: "#e7e7e7",
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid transparent",
  };

  return (
    <aside style={aside} aria-label="Left Navigation">
      <button style={{ ...btn, width: "100%", marginBottom: 8 }} onClick={() => setOpen(!open)}>
        {open ? "Hide" : "Show"}
      </button>

      <div style={{ display: "grid", gap: 8 }}>
        {cats.map((cat) => {
          const isOpen = expanded[cat.id];
          return (
            <section key={cat.id} style={section} aria-labelledby={`cat-${cat.id}`}>
              <button
                style={{ ...btn, width: "100%", display: "flex", justifyContent: "space-between" }}
                onClick={() => setExpanded((s) => ({ ...s, [cat.id]: !s[cat.id] }))}
                aria-expanded={isOpen}
                id={`cat-${cat.id}`}
              >
                <span>{open ? cat.label : cat.label.charAt(0)}</span>
                {open && <span style={{ opacity: 0.7 }}>{isOpen ? "▾" : "▸"}</span>}
              </button>

              {isOpen && (
                <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
                  {open && (
                    <button
                      style={{ ...btn, justifyContent: "flex-start" }}
                      onClick={() => navigate(cat.editTo)}
                      aria-label={`Edit ${cat.label}`}
                    >
                      ✎ Edit {cat.label}
                    </button>
                  )}
                  {cat.links.map((l) => (
                    <NavLink
                      key={l.to}
                      to={l.to}
                      style={({ isActive }) => ({
                        ...linkBase,
                        background: isActive ? "rgba(32,32,32,0.9)" : "transparent",
                        borderColor: isActive ? "rgba(255,255,255,0.08)" : "transparent",
                      })}
                    >
                      {open ? l.label : l.label.charAt(0)}
                    </NavLink>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </aside>
  );
}


