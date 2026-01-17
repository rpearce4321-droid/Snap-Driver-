import React from "react";
export default function Modal({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: React.ReactNode; }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60">
      <div className="card w-full max-w-2xl p-4">
        <div className="flex items-center justify-between">
          <div className="h2">{title}</div>
          <button className="btn" onClick={onClose}>Close</button>
        </div>
        <div className="mt-3">{children}</div>
      </div>
    </div>
  );
}


