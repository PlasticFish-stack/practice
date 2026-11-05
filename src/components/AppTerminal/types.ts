export type TerminalStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface TerminalSize {
  cols: number;
  rows: number;
}

export interface TerminalHandle {
  write(data: string | Uint8Array, parsed?: () => void): void;
  writeln(data: string): void;
  clear(): void;
  reset(): void;
  focus(): void;
  fit(): void;
  getSize(): TerminalSize;
  getSelection(): string;
  /** Read-only buffer state; read after a write's parsed callback. */
  getBuffer(): IBuffer | undefined;
}
import type { IBuffer } from '@xterm/xterm';
