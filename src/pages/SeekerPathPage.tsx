import React from "react";
import { Link } from "react-router-dom";

const DISPLAY_FONT = {
  fontFamily: '"Bebas Neue", "Oswald", "Arial Black", sans-serif',
};

const BODY_FONT = {
  fontFamily: '"Spline Sans", "Avenir Next", "Segoe UI", sans-serif',
};

const seekerBenefits = [
  "Turn every completed route into visible proof.",
  "Show what you do best: vehicle, schedule, specialties, badges.",
  "Interview faster with retainers that already fit your pace.",
  "Build reputation that compounds instead of resetting.",
  "Stay independent while winning consistent routes.",
];

const seekerSteps = [
  "Create your Seeker profile and add route history.",
  "Choose badges that match how you operate.",
  "Get approved and become visible to verified retainers.",
  "Interview directly and agree on a start date.",
  "Complete check-ins that verify work and build your score.",
  "Use your growing reputation to secure steady routes.",
];

const seekerProof = [
  "Verified check-ins build credibility.",
  "Reputation scores reward consistency.",
  "Visibility controls let you decide how you show up.",
  "You stay an independent business owner.",
];

const seekerControl = [
  "Profile media, badges, and vehicle details.",
  "Availability, service area, and preferred routes.",
  "Compliance documents and readiness signals.",
  "Direct messaging and interview scheduling.",
];

const seekerVerified = [
  "Route history and performance check-ins.",
  "Reputation trail that grows with real work.",
  "Admin approvals that keep quality high.",
  "Dispute handling for fairness and clarity.",
];

export default function SeekerPathPage() {
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
              Seeker Path
            </h1>
            <p className="mt-4 text-xl text-emerald-200" style={DISPLAY_FONT}>
              Build reputation that makes retainers call you first.
            </p>
            <p className="mt-4 text-sm text-slate-300 leading-relaxed">
              SnapDriver is built for independent contract drivers who want steady routes without the chaos. You bring
              the work history, we turn it into proof. That proof becomes your leverage - visible, trusted, and
              compounding every time you deliver.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link
                to="/signup/seeker"
                className="rounded-full bg-slate-100 px-6 py-2 text-xs font-semibold text-slate-900 hover:translate-y-[-1px] transition"
              >
                Become a seeker now
              </Link>
              <Link to="/" className="text-xs text-slate-300 hover:text-white transition">
                Already approved? Sign in on the landing page.
              </Link>
            </div>
          </div>
          <div className="rounded-[28px] border border-slate-800/70 bg-slate-950/70 p-6">
            <div className="text-xs uppercase tracking-[0.35em] text-slate-500">Why seekers join</div>
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              {seekerBenefits.map((item) => (
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
              {seekerControl.map((item) => (
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
              {seekerVerified.map((item) => (
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
              {seekerSteps.map((step, index) => (
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
            <div className="text-xs uppercase tracking-[0.35em] text-slate-500">Proof that sticks</div>
            <p className="mt-4 text-sm text-slate-300 leading-relaxed">
              SnapDriver rewards consistency. Every verified check-in strengthens your profile. Your score is designed
              to compound - the more dependable you are, the faster the right opportunities come to you.
            </p>
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              {seekerProof.map((item) => (
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
