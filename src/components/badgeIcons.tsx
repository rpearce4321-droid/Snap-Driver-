import React from "react";

export function badgeIconFor(
  key: string,
  className: string = "h-12 w-12"
): React.ReactNode {
  switch (key) {
    case "moon":
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none">
          <path
            d="M15.5 2.5c-3 1.2-5 4.1-5 7.5 0 4.5 3.6 8.1 8.1 8.1 1.2 0 2.3-.2 3.4-.7-1.3 3-4.2 5.1-7.7 5.1-4.7 0-8.5-3.8-8.5-8.5 0-3.9 2.6-7.2 6.2-8.2Z"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </svg>
      );
    case "bolt":
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none">
          <path
            d="M13 2 3 14h7l-1 8 12-14h-7l-1-6Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "wrench":
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none">
          <path
            d="M21 7a6 6 0 0 1-8.6 5.4L7.5 17.3a2 2 0 0 1-2.8 0l-.9-.9a2 2 0 0 1 0-2.8l4.9-4.9A6 6 0 0 1 17 3l-3 3 4 4 3-3Z"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </svg>
      );
    case "clock":
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none">
          <path
            d="M12 22a10 10 0 1 0-10-10 10 10 0 0 0 10 10Z"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M12 6v6l4 2"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      );
    case "shield":
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none">
          <path
            d="M12 2 20 6v6c0 5-3.4 9.4-8 10-4.6-.6-8-5-8-10V6l8-4Z"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </svg>
      );
    case "chat":
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none">
          <path
            d="M4 5h16v11H7l-3 3V5Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path
            d="M7 9h10M7 12h7"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      );
    case "cash":
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none">
          <path d="M3 7h18v10H3V7Z" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M6 10a2 2 0 0 0 2-2M18 14a2 2 0 0 0-2 2"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      );
    case "check":
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none">
          <path
            d="m6 12 4 4 8-8"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M12 22a10 10 0 1 0-10-10 10 10 0 0 0 10 10Z"
            stroke="currentColor"
            strokeWidth="1.2"
          />
        </svg>
      );
    case "route":
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none">
          <path
            d="M6 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm12 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M8 8h5a4 4 0 0 1 4 4v2"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      );
    case "clipboard":
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none">
          <path d="M9 3h6v3H9V3Z" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M7 5H5v16h14V5h-2"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path
            d="M8 10h8M8 14h6"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      );
    case "lifebuoy":
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none">
          <path
            d="M12 22a10 10 0 1 0-10-10 10 10 0 0 0 10 10Z"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M12 16a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M4.9 4.9 8 8m8 8 3.1 3.1M19.1 4.9 16 8M8 16 4.9 19.1"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      );
    case "scales":
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none">
          <path
            d="M12 3v18"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            d="M5 6h14"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            d="M7 6 4 12h6L7 6Zm10 0-3 6h6l-3-6Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path
            d="M8 21h8"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      );
    case "calendar":
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none">
          <path
            d="M7 3v3M17 3v3M4 9h16"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            d="M6 5h12a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </svg>
      );
    case "box":
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none">
          <path
            d="M4 8 12 4l8 4-8 4-8-4Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path
            d="M4 8v10l8 4 8-4V8"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path
            d="M12 12v10"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      );
    case "spark":
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none">
          <path
            d="M12 2l1.2 4.3L17.5 7.5l-4.3 1.2L12 13l-1.2-4.3L6.5 7.5l4.3-1.2L12 2Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path
            d="M5 14l.7 2.4L8 17l-2.3.6L5 20l-.7-2.4L2 17l2.3-.6L5 14Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "smile":
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none">
          <path
            d="M12 22a10 10 0 1 0-10-10 10 10 0 0 0 10 10Z"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M8 10h.01M16 10h.01"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M8.5 14c.9 1.2 2.1 2 3.5 2s2.6-.8 3.5-2"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      );
    case "leaf":
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none">
          <path
            d="M20 4c-7 1-12 6-12 13 0 2.8 1.2 4.5 3 5 4.2-1.2 7-5.6 7-11 0-2-.3-4-.9-7Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path
            d="M6 18c3-2 6-5 9-9"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      );
    case "users":
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none">
          <path
            d="M9 11a3 3 0 1 0-3-3 3 3 0 0 0 3 3Z"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M17 10a2.5 2.5 0 1 0-2.5-2.5A2.5 2.5 0 0 0 17 10Z"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M3.5 20a5.5 5.5 0 0 1 11 0"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            d="M14.5 20a4 4 0 0 1 6 0"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      );
    case "lock":
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none">
          <path
            d="M7 11V8a5 5 0 0 1 10 0v3"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            d="M6 11h12v10H6V11Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "target":
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none">
          <path
            d="M12 22a10 10 0 1 0-10-10 10 10 0 0 0 10 10Z"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M12 16a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M12 12h8"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            d="M18 10l2 2-2 2"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "book":
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none">
          <path
            d="M6 4h11a2 2 0 0 1 2 2v14H8a2 2 0 0 0-2 2V4Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path
            d="M6 20h13"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      );
    case "star":
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none">
          <path
            d="M12 2l3.1 6.6 7.2 1-5.2 5.1 1.2 7.2L12 18.7 5.7 22l1.2-7.2L1.7 9.6l7.2-1L12 2Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "eye":
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none">
          <path
            d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path
            d="M12 15a3 3 0 1 0-3-3 3 3 0 0 0 3 3Z"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </svg>
      );
    case "arrow":
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none">
          <path
            d="M5 12h12"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            d="M13 6l6 6-6 6"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    default:
      return (
        <div
          className={[
            className,
            "rounded-md bg-white/10 border border-white/10",
          ].join(" ")}
        />
      );
  }
}
