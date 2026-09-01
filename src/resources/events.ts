import { eventsPath } from "../http/routes";
import type { EventId, SomesEvent } from "../types/misc";
import { Resource } from "./base";

/** Community events. Listing is public; all mutations require an admin token. */
export class EventsResource extends Resource {
  /**
   * The server mounts this as `/v1/events` with no trailing slash; requesting
   * `/v1/events/` returns 404.
   */
  list(): Promise<SomesEvent[]> {
    return this.http.get<SomesEvent[]>(eventsPath(this.country, ""));
  }

  /** Admin only. `event.id` is ignored; the assigned id is returned. */
  async create(event: Omit<SomesEvent, "id">): Promise<EventId> {
    return this.http.post<EventId>(eventsPath(this.country, "/create"), { ...event, id: null }, {
      token: this.token(),
    });
  }

  /** Admin only. */
  async update(event: SomesEvent): Promise<void> {
    await this.http.put(eventsPath(this.country, "/update"), event, { token: this.token() });
  }

  /** Admin only. */
  async remove(id: number): Promise<void> {
    await this.http.delete(eventsPath(this.country, "/delete"), { id }, { token: this.token() });
  }
}
