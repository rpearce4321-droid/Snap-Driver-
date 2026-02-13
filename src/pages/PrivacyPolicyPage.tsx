import React from "react";
import { Link } from "react-router-dom";
import { downloadLegalPdf, type LegalSection } from "../lib/legalPdf";

const BODY_FONT = {
  fontFamily: '"Spline Sans", "Avenir Next", "Segoe UI", sans-serif',
};

const DISPLAY_FONT = {
  fontFamily: '"Bebas Neue", "Oswald", "Arial Black", sans-serif',
};

const LAST_UPDATED = "February 13, 2026";

const PLACEHOLDERS = {
  companyName: "[Company Legal Name]",
  address: "[Business Address]",
  supportEmail: "[Support Email]",
};

const SECTIONS: LegalSection[] = [
  {
    title: "Overview",
    body: [
      `${PLACEHOLDERS.companyName} ("we", "our", "us") provides the SnapDriver platform (the "Service"). This Privacy Policy explains how we collect, use, and share information when you use the Service as a Seeker or Retainer.`,
      `By using the Service, you agree to the collection and use of information as described here.`,
    ],
  },
  {
    title: "Information We Collect",
    body: [
      "Account data such as name, email, phone number, role, and authentication details.",
      "Profile data such as company details, service areas, availability, vehicle details, and other profile fields you submit.",
      "Media you upload, including photos and short profile videos.",
      "Reputation and work history data, including badge check-ins, approvals, and route history.",
      "Communications such as messages, disputes, and support requests.",
      "Scheduling data, including interview slots and meeting confirmations.",
      "Technical data such as device identifiers, logs, and usage analytics.",
    ],
  },
  {
    title: "How We Use Information",
    body: [
      "Operate, maintain, and improve the Service.",
      "Match Seekers and Retainers based on routes, schedules, and reputation signals.",
      "Generate reputation scores and badge progress based on verified activity.",
      "Facilitate messaging, scheduling, and interview coordination.",
      "Provide support, safety, and compliance monitoring.",
    ],
  },
  {
    title: "How We Share Information",
    body: [
      "With other users when needed to complete matches, links, and route workflows (for example, profile and reputation data).",
      "With service providers that help us operate the Service (hosting, storage, analytics).",
      "With legal or regulatory authorities if required to comply with law or protect the Service.",
    ],
  },
  {
    title: "Calendar and Meeting Data",
    body: [
      "If you connect Google Calendar, we store OAuth tokens to schedule interviews and create Meet links.",
      "We request only the minimum scopes required to create and manage calendar events.",
      "You can disconnect Google Calendar at any time from the Interviews tab.",
    ],
  },
  {
    title: "Data Retention",
    body: [
      "We retain information for as long as your account is active and as needed to provide the Service.",
      "Reputation and work history may be retained to preserve historical credibility and compliance.",
      "You can request deletion, and we will honor it subject to legal obligations and platform integrity.",
    ],
  },
  {
    title: "Security",
    body: [
      "We use reasonable administrative, technical, and physical safeguards to protect data.",
      "No method of transmission or storage is 100% secure, but we work to protect your information.",
    ],
  },
  {
    title: "Your Choices",
    body: [
      "You can update your profile at any time from your account settings.",
      "You may request access, correction, or deletion by contacting support.",
      "If you disable or remove media, some reputation features may be affected.",
    ],
  },
  {
    title: "Children",
    body: [
      "The Service is not intended for individuals under 18. We do not knowingly collect data from minors.",
    ],
  },
  {
    title: "Contact",
    body: [
      `If you have questions about this Privacy Policy, contact ${PLACEHOLDERS.supportEmail}.`,
      `Business address: ${PLACEHOLDERS.address}.`,
    ],
  },
];

const DISCLAIMER =
  "This Privacy Policy is a placeholder draft provided for review. It is not legal advice and should be reviewed by qualified counsel before use.";

export default function PrivacyPolicyPage() {
  const handleDownload = () => {
    downloadLegalPdf({
      title: "Privacy Policy",
      fileName: "SnapDriver-Privacy-Policy.pdf",
      lastUpdated: LAST_UPDATED,
      sections: SECTIONS,
      disclaimer: DISCLAIMER,
    });
  };

  return (
    <main
      className="min-h-screen bg-[#0a0f18] text-slate-100 px-6 py-12"
      style={BODY_FONT as React.CSSProperties}
    >
      <style>
        {`@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Spline+Sans:wght@300;400;500;600&display=swap');`}
      </style>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link to="/" className="text-xs uppercase tracking-wide text-slate-400 hover:text-slate-200">
            Back to Home
          </Link>
          <button
            type="button"
            onClick={handleDownload}
            className="rounded-full border border-emerald-500/40 bg-emerald-500/20 px-4 py-2 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/30 transition"
          >
            Download PDF
          </button>
        </div>

        <header className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6">
          <div className="text-xs uppercase tracking-[0.3em] text-slate-500">Legal</div>
          <h1 className="mt-2 text-4xl text-slate-50" style={DISPLAY_FONT}>
            Privacy Policy
          </h1>
          <div className="mt-2 text-sm text-slate-400">Last updated: {LAST_UPDATED}</div>
        </header>

        <div className="space-y-6">
          {SECTIONS.map((section) => (
            <section key={section.title} className="rounded-3xl border border-slate-800 bg-slate-950/60 p-6 space-y-3">
              <h2 className="text-lg font-semibold text-slate-100">{section.title}</h2>
              {section.body.map((paragraph) => (
                <p key={paragraph} className="text-sm text-slate-300 leading-relaxed">
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
        </div>

        <div className="rounded-3xl border border-amber-500/40 bg-amber-500/10 p-6 text-sm text-amber-100">
          {DISCLAIMER}
        </div>
      </div>
    </main>
  );
}
