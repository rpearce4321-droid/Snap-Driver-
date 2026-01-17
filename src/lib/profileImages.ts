import type { Retainer, Seeker } from "./data";
import { getStockImageUrl } from "./stockImages";

export function getSeekerAvatarUrl(seeker: Seeker): string {
  const s: any = seeker as any;
  return (
    s.photoUrl ||
    s.profileImageUrl ||
    s.avatarUrl ||
    s.imageUrl ||
    s.driverPhotoUrl ||
    getStockImageUrl("SEEKER", String(s.id ?? ""))
  );
}

export function getRetainerAvatarUrl(retainer: Retainer): string {
  const r: any = retainer as any;
  return (
    r.logoUrl ||
    r.photoUrl ||
    r.profileImageUrl ||
    r.imageUrl ||
    r.companyPhotoUrl ||
    getStockImageUrl("RETAINER", String(r.id ?? ""))
  );
}
