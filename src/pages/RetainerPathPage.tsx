import React from "react";
import { Link } from "react-router-dom";

const DISPLAY_FONT = {
  fontFamily: '"Bebas Neue", "Oswald", "Arial Black", sans-serif',
};

const BODY_FONT = {
  fontFamily: '"Spline Sans", "Avenir Next", "Segoe UI", sans-serif',
};

const retainerBenefits = [
  "Hire with proof-backed reliability signals.",
  "See who can handle your workflow before day one.",
  "Interview multiple seekers at once and move fast.",
  "Lock coverage with clear expectations and start dates.",
  "Build a bench you can re-engage without churn.",
];

const retainerSteps = [
  "Create your Retainer profile and define route needs.",
  "Review seekers by verified route history.",
  "Invite short-listed seekers to video interviews.",
  "Confirm the best match and lock a start date.",
  "Track check-ins and attendance to protect quality.",
  "Build a dependable bench you can re-engage.",
];

const retainerControls = [
  "Verified profiles and compliance visibility.",
  "Structured interviews and scheduling.",
  "Reputation scoring that identifies top performers.",
  "Admin oversight for approvals and disputes.",
];

const retainerControl = [
  "Route needs, schedules, and expectations.",
  "Interview slots and invite lists.",
  "Approval and start date confirmations.",
  "Visibility into reliability and check-in trails.",
];

const retainerVerified = [
  "Seeker route history and check-ins.",
  "Reputation scores tied to performance.",
  "Profile readiness and compliance documents.",
  "Attendance outcomes tracked per meeting.",
];

export default function RetainerPathPage() {
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
        <div className="flex items-center justify-between text-xs text-slate-100">
          <Link to="/" className="hover:text-white transition">
            Back to SnapDriver
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/mission" className="hover:text-white transition">
              Mission
            </Link>
            <Link to="/how-it-works" className="hover:text-white transition">
              How it works
            </Link>
            <Link to="/admin" className="hover:text-white transition">
              Admin Login
            </Link>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <h1 className="text-6xl md:text-7xl leading-[0.9] text-slate-50" style={DISPLAY_FONT}>
              Retainer Path
            </h1>
            <p className="mt-4 text-xl text-emerald-200" style={DISPLAY_FONT}>
              Hire with proof and keep routes covered.
            </p>
            <p className="mt-4 text-sm text-slate-300 leading-relaxed">
              SnapDriver gives route owners a clean, verified signal on who will show up and deliver. Verified route
              history, structured interviews, and dual approval check-ins turn hiring into a repeatable system instead
              of a gamble.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link
                to="/signup/retainer"
                className="rounded-full bg-slate-100 px-6 py-2 text-xs font-semibold text-slate-900 hover:translate-y-[-1px] transition"
              >
                Become a retainer now
              </Link>
              <Link to="/" className="text-xs text-slate-300 hover:text-white transition">
                Already approved? Sign in on the landing page.
              </Link>
            </div>
          </div>
          <div className="rounded-[28px] border border-slate-800/70 bg-slate-950/70 p-6">
            <div className="text-xs uppercase tracking-[0.35em] text-slate-500">Why retainers join</div>
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              {retainerBenefits.map((item) => (
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

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-[28px] border border-slate-800/70 bg-slate-950/70 p-6">
            <div className="text-xs uppercase tracking-[0.35em] text-slate-500">What you control</div>
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              {retainerControl.map((item) => (
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
            <div className="text-xs uppercase tracking-[0.35em] text-slate-500">What gets verified</div>
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              {retainerVerified.map((item) => (
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

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-[28px] border border-slate-800/70 bg-slate-950/70 p-6">
            <div className="text-xs uppercase tracking-[0.35em] text-slate-500">How it works</div>
            <div className="mt-4 space-y-4 text-sm text-slate-300">
              {retainerSteps.map((step, index) => (
                <div key={step} className="flex items-start gap-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-xs text-slate-200">
                    {index + 1}
                  </div>
                  <div className="rounded-2xl border border-slate-800/70 bg-slate-900/40 px-4 py-3">
                    {step}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-[28px] border border-slate-800/70 bg-slate-950/70 p-6">
            <div className="text-xs uppercase tracking-[0.35em] text-slate-500">Quality controls</div>
            <p className="mt-4 text-sm text-slate-300 leading-relaxed">
              Retainers get clarity up front. Profiles are verified, interviews are structured, and every route has a
              clean check-in trail. That means fewer surprises, faster placements, and a stronger bench.
            </p>
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              {retainerControls.map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-slate-800/70 bg-slate-900/40 px-4 py-3"
                >
                  {item}
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-slate-500">
              SnapDriver is a marketplace for 1099 delivery services - not a broker or dispatcher.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
