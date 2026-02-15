import React from "react";
import { Link } from "react-router-dom";

const DISPLAY_FONT = {
  fontFamily: '"Bebas Neue", "Oswald", "Arial Black", sans-serif',
};

const BODY_FONT = {
  fontFamily: '"Spline Sans", "Avenir Next", "Segoe UI", sans-serif',
};

const principles = [
  {
    title: "Proof Over Promises",
    body: "Every decision is grounded in validated route history, not just claims.",
  },
  {
    title: "Consistency Compounds",
    body: "Reliable follow-through builds momentum that stays visible and actionable.",
  },
  {
    title: "Mutual Accountability",
    body: "Seekers and retainers both confirm check-ins to protect quality for everyone.",
  },
];

export default function MissionPage() {
  return (
    <main
      className="min-h-screen bg-[#0a0f18] text-slate-100 relative overflow-hidden"
      style={BODY_FONT as React.CSSProperties}
    >
      <style>
        {`@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Spline+Sans:wght@300;400;500;600&display=swap');`}
      </style>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.12),transparent_55%),radial-gradient(circle_at_20%_80%,_rgba(16,185,129,0.18),transparent_45%),radial-gradient(circle_at_80%_85%,_rgba(244,63,94,0.15),transparent_40%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(15,23,42,0.6),rgba(2,6,23,0.9))]" />

      <div className="relative max-w-5xl mx-auto px-6 py-16 space-y-10">
        <div className="flex items-center justify-between">
          <Link
            to="/"
            className="text-xs uppercase tracking-[0.35em] text-slate-500 hover:text-slate-300 transition"
          >
            Back to SnapDriver
          </Link>
          <Link
            to="/admin"
            className="rounded-full border border-slate-700 bg-slate-950/70 px-4 py-2 text-[11px] font-semibold text-slate-200 hover:bg-slate-800 transition"
          >
            Admin Login
          </Link>
        </div>

        <div>
          <h1 className="text-5xl md:text-6xl leading-[0.9] text-slate-50" style={DISPLAY_FONT}>
            Mission Statement
          </h1>
          <p className="mt-4 text-sm text-slate-300">
            SnapDriver exists to capture real-world route performance and convert it into a shared reputation layer that
            protects quality, rewards consistency, and makes dependable partnerships scalable.
          </p>
        </div>

        <div className="rounded-[24px] border border-slate-800/70 bg-slate-950/70 p-6 space-y-4">
          <div className="text-xs uppercase tracking-[0.35em] text-slate-500">Origin story</div>
          <p className="text-sm text-slate-300 leading-relaxed">
            In 2011 our founder answered a simple "driver wanted" ad and walked into a back-door warehouse interview
            with zero context. In the first year alone he cycled through four routes and three brokers, pay dropped,
            fees climbed, and the same end customer kept moving behind different management companies.
          </p>
          <p className="text-sm text-slate-300 leading-relaxed">
            When he moved to the management side, the chaos looked identical from the inside. No shared information.
            No consistent standards. Just guesswork. SnapDriver exists to replace that loop with validated context,
            honest expectations, and reputation built on real performance.
          </p>
        </div>

        <div className="rounded-[24px] border border-slate-800/70 bg-slate-950/70 p-6">
          <div className="text-xs uppercase tracking-[0.35em] text-slate-500">What breaks today</div>
          <div className="mt-4 grid gap-3 md:grid-cols-3 text-sm text-slate-300">
            <div className="rounded-2xl border border-slate-800/70 bg-slate-900/40 px-4 py-3">
              Disconnected listings with no shared standards.
            </div>
            <div className="rounded-2xl border border-slate-800/70 bg-slate-900/40 px-4 py-3">
              Ghosting on day one with no accountability trail.
            </div>
            <div className="rounded-2xl border border-slate-800/70 bg-slate-900/40 px-4 py-3">
              No reliable way to prove performance or fit.
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {principles.map((item) => (
            <div
              key={item.title}
              className="rounded-[24px] border border-slate-800/70 bg-slate-950/70 p-5"
            >
              <div className="text-sm text-slate-100 font-semibold">{item.title}</div>
              <p className="mt-2 text-sm text-slate-300">{item.body}</p>
            </div>
          ))}
        </div>

        <div className="rounded-[24px] border border-slate-800/70 bg-slate-950/70 p-6">
          <div className="text-xs uppercase tracking-[0.35em] text-slate-500">What we built</div>
          <p className="mt-3 text-sm text-slate-300">
            We built a private logistics marketplace where reputation is earned through mutual check-ins. Seekers gain
            visibility through proof of delivery, and retainers engage with clear signals that reduce churn. Every route
            connection is anchored in evidence, not guesswork.
          </p>
        </div>

        <div className="rounded-[24px] border border-slate-800/70 bg-slate-950/70 p-6">
          <div className="text-xs uppercase tracking-[0.35em] text-slate-500">Scope of business</div>
          <p className="mt-3 text-sm text-slate-300 leading-relaxed">
            SnapDriver is a dedicated platform for advertising, promoting, seeking, and retaining 1099 delivery
            services. We do not broker or manage routes; we provide the marketplace, validation tools, and operating
            context that help both sides work smarter.
          </p>
          <p className="mt-3 text-sm text-slate-300 leading-relaxed">
            Core capabilities include profile confirmations, secure messaging, video interviews, document storage,
            ratings, and administrative review to keep quality high at scale.
          </p>
        </div>

        <div className="rounded-[24px] border border-slate-800/70 bg-slate-950/70 p-6">
          <div className="text-xs uppercase tracking-[0.35em] text-slate-500">Independent contractor notice</div>
          <p className="mt-3 text-sm text-slate-300 leading-relaxed">
            SnapDriver does not employ, supervise, or control Seekers. Retainers and Seekers independently set their
            agreements, schedules, and performance expectations. Each party is responsible for their own compliance,
            taxes, insurance, and required documentation.
          </p>
        </div>
      </div>
    </main>
  );
}
