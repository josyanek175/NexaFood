import { EventEmitter } from "node:events";

export type EstablishmentEventType = "order.created" | "order.updated" | "table.updated";

export type EstablishmentEvent = {
  type: EstablishmentEventType;
  establishmentId: string;
  at: string;
  payload?: Record<string, unknown>;
};

type Listener = (event: EstablishmentEvent) => void;

/** In-process pub/sub for ops SSE (single-instance). */
class EstablishmentEventBus {
  private readonly emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(200);
  }

  publish(event: Omit<EstablishmentEvent, "at"> & { at?: string }): void {
    const full: EstablishmentEvent = {
      ...event,
      at: event.at ?? new Date().toISOString(),
    };
    this.emitter.emit(full.establishmentId, full);
  }

  subscribe(establishmentId: string, listener: Listener): () => void {
    this.emitter.on(establishmentId, listener);
    return () => {
      this.emitter.off(establishmentId, listener);
    };
  }
}

export const establishmentEvents = new EstablishmentEventBus();
