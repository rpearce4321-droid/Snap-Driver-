import type { Retainer, Seeker } from "../lib/data";
import { getRetainerAvatarUrl, getSeekerAvatarUrl } from "../lib/profileImages";

type ProfileAvatarProps = {
  role: "SEEKER" | "RETAINER";
  profile: Seeker | Retainer;
  name?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizeClass: Record<NonNullable<ProfileAvatarProps["size"]>, string> = {
  sm: "h-8 w-8",
  md: "h-9 w-9",
  lg: "h-12 w-12",
};

export default function ProfileAvatar({
  role,
  profile,
  name,
  size = "lg",
  className,
}: ProfileAvatarProps) {
  const url =
    role === "SEEKER"
      ? getSeekerAvatarUrl(profile as Seeker)
      : getRetainerAvatarUrl(profile as Retainer);
  const label = name || "Profile";

  return (
    <div
      className={[
        "rounded-full overflow-hidden border border-slate-700 bg-slate-800 shrink-0",
        sizeClass[size],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <img src={url} alt={label} className="h-full w-full object-cover" />
    </div>
  );
}
