import { EventEmitter } from 'node:events';
import type { SidecarState } from '../shared/ipc-schemas';

class SidecarManager extends EventEmitter {
  private state: SidecarState = 'starting';
  private port = 38080;

  getState(): SidecarState {
    return this.state;
  }

  getUrl(): string {
    return `http://127.0.0.1:${this.port}`;
  }

  setPort(port: number): void {
    this.port = port;
  }

  start(): void {
    // Backend not yet implemented (Phase 2). For now we report 'ready'
    // so the frontend can be developed against a future or mocked backend.
    this.state = 'starting';
    this.emit('state', this.state);
    setTimeout(() => {
      this.state = 'ready';
      this.emit('state', this.state);
    }, 250);
  }

  async restart(): Promise<void> {
    this.state = 'starting';
    this.emit('state', this.state);
    await new Promise((r) => setTimeout(r, 300));
    this.state = 'ready';
    this.emit('state', this.state);
  }

  stop(): void {
    this.state = 'exited';
    this.emit('state', this.state);
  }
}

export const sidecar = new SidecarManager();
