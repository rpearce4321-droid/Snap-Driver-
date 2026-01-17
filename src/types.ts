export type Status = "pending"|"approved"|"rejected"|"suspended"
export interface Seeker { id: string; name: string; city: string; state: string; zip: string; status: Status; }
export interface Retainer { id: string; company: string; city: string; state: string; zip: string; status: Status; }
export interface AdminStats { seekers: Record<Status, number>; retainers: Record<Status, number>; }


