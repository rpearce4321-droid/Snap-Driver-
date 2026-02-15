import React from "react";
import { Link } from "react-router-dom";

const DISPLAY_FONT = {
  fontFamily: '"Bebas Neue", "Oswald", "Arial Black", sans-serif',
};

const BODY_FONT = {
  fontFamily: '"Spline Sans", "Avenir Next", "Segoe UI", sans-serif',
};

const seekerSteps = [
  "Create a Seeker profile and add route history.",
  "Select badges that match strengths and focus areas.",
  "Get approved to activate a validated reputation trail.",
  "Join interviews with retainers that match your pace.",
  "Confirm a start date and align route commitments.",
  "Complete check-ins that confirm real work and follow-through.",
  "Grow your score and unlock more reliable, recurring work.",
];

const retainerSteps = [
  "Create a Retainer profile and publish route needs.",
  "Review seekers by validated history, not just claims.",
  "Invite multiple seekers to interview in a single Meet.",
  "Confirm the best match and a start date.",
  "Track attendance, check-ins, and route reliability.",
  "Keep a stable independent network with accountability baked in.",
  "Use insights to reduce churn and protect quality.",
];

const safeguards = [
  "Admin approvals keep profiles and badges honest.",
  "Dual approval check-ins confirm real work.",
  "Dispute handling keeps accountability fair.",
  "Attendance outcomes stay tied to the record.",
];

const outcomes = [
  "Less time screening unqualified applicants.",
  "Faster placements with clearer expectations.",
  "Stronger retention through reputation signals.",
  "A marketplace that rewards consistency.",
];

function WorkflowColumn({
  title,
  lead,
  steps,
  accent,
}: {
  title: string;
  lead: string;
  steps: string[];
  accent: string;
}) {
  return (
    <section className="rounded-[28px] border border-slate-800/70 bg-slate-950/70 p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.35em] text-slate-500">{title}</div>
          <div className="mt-2 text-sm text-slate-300">{lead}</div>
        </div>
        <div className="h-10 w-10 rounded-full" style={{ background: accent }} />
      </div>
      <div className="mt-6 space-y-4">
        {steps.map((step, index) => (
          <div key={step} className="flex items-start gap-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-xs text-slate-200">
              {index + 1}
            </div>
            <div className="rounded-2xl border border-slate-800/70 bg-slate-900/40 px-4 py-3 text-sm text-slate-200">
              {step}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function HowItWorksPage() {
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

      <div className="relative max-w-6xl mx-auto px-6 py-16 space-y-10">
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
            How SnapDriver Works
          </h1>
          <p className="mt-4 max-w-2xl text-sm text-slate-300">
            SnapDriver is built around validated performance, shared accountability, and a clear path to dependable
            routes. Each side follows a straightforward, top-to-bottom flow that keeps expectations aligned.
          </p>
        </div>

        <div className="rounded-[28px] border border-slate-800/70 bg-slate-950/70 p-6">
          <div className="text-xs uppercase tracking-[0.35em] text-slate-500">The trust loop</div>
          <div className="mt-4 grid gap-3 md:grid-cols-3 text-sm text-slate-300">
            {[
              "Profile confirmations establish credibility before the first call.",
              "Dual approval check-ins confirm real work on every route.",
              "Reputation scores compound over time and reduce churn.",
            ].map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-slate-800/70 bg-slate-900/40 px-4 py-3"
              >
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <WorkflowColumn
            title="Seeker Workflow"
            lead="Independent drivers build credibility and earn repeat work."
            steps={seekerSteps}
            accent="rgba(16,185,129,0.55)"
          />
          <WorkflowColumn
            title="Retainer Workflow"
            lead="Route owners select with proof and keep coverage steady."
            steps={retainerSteps}
            accent="rgba(248,113,113,0.55)"
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-[28px] border border-slate-800/70 bg-slate-950/70 p-6">
            <div className="text-xs uppercase tracking-[0.35em] text-slate-500">Safeguards</div>
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              {safeguards.map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-slate-800/70 bg-slate-900/40 px-4 py-3"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-[28px] border border-slate-800/70 bg-slate-950/70 p-6">
            <div className="text-xs uppercase tracking-[0.35em] text-slate-500">Outcomes</div>
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              {outcomes.map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-slate-800/70 bg-slate-900/40 px-4 py-3"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-slate-800/70 bg-slate-950/70 p-6">
          <div className="text-xs uppercase tracking-[0.35em] text-slate-500">Why this works</div>
          <p className="mt-3 text-sm text-slate-300 leading-relaxed">
            Generic listings flood retainers with unqualified applicants and push seekers into the same chaotic
            pipeline. SnapDriver keeps the focus on validated delivery history, clear expectations, and a faster
            interview-to-start path designed for the 1099 market.
          </p>
        </div>

        <div className="rounded-[28px] border border-slate-800/70 bg-slate-950/70 p-6">
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
