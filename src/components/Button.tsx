import type { ButtonHTMLAttributes } from "react"

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { tone?: "default"|"primary"|"danger"|"warn" }

export default function Button({ tone="default", className="", ...p }: Props){
  const base = "px-3 py-2 rounded-lg border text-sm transition"
  const tones: Record<string,string> = {
    default: "bg-zinc-800 border-white/10 hover:bg-zinc-700",
    primary: "bg-indigo-600 border-transparent hover:bg-indigo-500",
    danger:  "bg-rose-600 border-transparent hover:bg-rose-500",
    warn:    "bg-amber-600 border-transparent hover:bg-amber-500",
  }
  return (
    <button
      {...p}
      className={`${base} ${tones[tone]} ${p.disabled ? "opacity-50 cursor-not-allowed" : ""} ${className}`}
    />
  )
}


