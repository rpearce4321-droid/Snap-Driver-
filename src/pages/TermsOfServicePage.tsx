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
  jurisdiction: "[Governing Law / Jurisdiction]",
};

const SECTIONS: LegalSection[] = [
  {
    title: "Acceptance of Terms",
    body: [
      `These Terms of Service ("Terms") govern your use of the SnapDriver platform (the "Service") provided by ${PLACEHOLDERS.companyName}. By accessing or using the Service, you agree to these Terms.`,
    ],
  },
  {
    title: "Eligibility",
    body: [
      "You must be at least 18 years old to use the Service.",
      "You represent that you have authority to enter into these Terms on behalf of your organization if applicable.",
    ],
  },
  {
    title: "Accounts and Profiles",
    body: [
      "You are responsible for maintaining the confidentiality of your login credentials.",
      "You must provide accurate profile information and keep it updated.",
      "We may suspend or terminate accounts that violate these Terms or platform policies.",
    ],
  },
  {
    title: "Service Roles",
    body: [
      "Seekers create profiles and earn reputation through verified work history and badges.",
      "Retainers create routes, schedule interviews, and engage Seekers based on reputation signals.",
    ],
  },
  {
    title: "Reputation and Badge System",
    body: [
      "Badges, approvals, and reputation scores are generated from in-platform confirmations.",
      "We do not guarantee outcomes or employment, and reputation data is informational.",
      "Abuse or manipulation of the system may result in suspension or removal.",
    ],
  },
  {
    title: "Subscriptions and Fees",
    body: [
      "Some features require a paid subscription.",
      "Fees, billing cycles, and entitlements are described in the platform and may change with notice.",
    ],
  },
  {
    title: "Content and Media",
    body: [
      "You retain ownership of content you upload, but grant us a license to display it within the Service.",
      "You are responsible for ensuring you have rights to the content you provide.",
    ],
  },
  {
    title: "Prohibited Conduct",
    body: [
      "Do not impersonate others, misrepresent credentials, or falsify route performance.",
      "Do not attempt to access other accounts, data, or systems without authorization.",
      "Do not use the Service for unlawful activities or to violate third-party rights.",
    ],
  },
  {
    title: "Disclaimers",
    body: [
      "The Service is provided on an \"as is\" basis without warranties of any kind.",
      "We do not guarantee matches, earnings, or business outcomes.",
    ],
  },
  {
    title: "Limitation of Liability",
    body: [
      "To the maximum extent permitted by law, we are not liable for indirect or consequential damages.",
      "Our total liability is limited to the amount you paid to use the Service in the preceding 12 months.",
    ],
  },
  {
    title: "Termination",
    body: [
      "You may stop using the Service at any time.",
      "We may suspend or terminate access for violations, security concerns, or legal compliance.",
    ],
  },
  {
    title: "Governing Law",
    body: [
      `These Terms are governed by ${PLACEHOLDERS.jurisdiction}.`,
    ],
  },
  {
    title: "Contact",
    body: [
      `Questions about these Terms can be sent to ${PLACEHOLDERS.supportEmail}.`,
      `Business address: ${PLACEHOLDERS.address}.`,
    ],
  },
];

const DISCLAIMER =
  "This Terms of Service document is a placeholder draft provided for review. It is not legal advice and should be reviewed by qualified counsel before use.";

export default function TermsOfServicePage() {
  const handleDownload = () => {
    downloadLegalPdf({
      title: "Terms of Service",
      fileName: "SnapDriver-Terms-of-Service.pdf",
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
            Terms of Service
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
