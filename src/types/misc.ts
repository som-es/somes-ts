import type { IsoDate, IsoTime } from "./common";

export interface SomesEvent {
  /** Absent when creating; assigned by the server. */
  id: number | null;
  title: string;
  location: string;
  event_date: IsoDate;
  start_time: IsoTime;
  description: string;
  image: string | null;
  requires_membership: boolean | null;
  requires_registration: boolean | null;
}

export interface EventId {
  id: number;
}
