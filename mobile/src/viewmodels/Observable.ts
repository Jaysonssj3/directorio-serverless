export class Observable<S> {
  private listeners = new Set<() => void>();
  constructor(protected state: S) {}
  getSnapshot = (): S => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  protected set(patch: Partial<S>) { this.state = { ...this.state, ...patch }; this.listeners.forEach(listener => listener()); }
}
export function message(error: unknown) { return error instanceof Error ? error.message : 'No se pudo completar la operación.'; }
