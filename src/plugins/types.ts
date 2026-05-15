import { SerialBridge } from '../core/serial-bridge';

export interface CommandDef {
  name: string;
  description: string;
  action: (args: string[], api: ControllerAPI) => Promise<void>;
}

export interface WebRouteDef {
  path: string;
  label: string;
  icon?: string;
}

export interface INintrollerPlugin {
  name: string;
  version: string;
  description: string;

  onLoad(api: ControllerAPI): Promise<void>;
  onUnload(): Promise<void>;

  getCommands(): CommandDef[];
  getWebRoutes?(): WebRouteDef[];
}

export type Button =
  | 'A' | 'B' | 'X' | 'Y'
  | 'L' | 'R' | 'ZL' | 'ZR'
  | 'PLUS' | 'MINUS' | 'HOME' | 'CAPTURE'
  | 'LS' | 'RS'
  | 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

export interface ControllerAction {
  type: 'btn' | 'hold' | 'stick' | 'wait';
  button?: Button;
  stickSide?: 'L' | 'R';
  stickX?: number;
  stickY?: number;
  duration: number;
}

export interface ESP32Status {
  connected: boolean;
  port: string | null;
  mode: 'immediate' | 'sequence';
  firmware: string;
  btConnected: boolean;
  sequenceSize: number;
  sequenceCapacity: number;
}

export interface ControllerAPI {
  pressButton(btn: Button, durationMs?: number): Promise<void>;
  holdButton(btn: Button, durationMs: number): Promise<void>;
  tapButton(btn: Button, count: number): Promise<void>;
  moveStick(side: 'L' | 'R', x: number, y: number, durationMs?: number): Promise<void>;
  wait(ms: number): Promise<void>;

  beginSequence(): Promise<void>;
  addToSequence(action: ControllerAction): Promise<void>;
  playSequence(): Promise<void>;
  clearSequence(): Promise<void>;

  getStatus(): Promise<ESP32Status>;
  sendRaw(command: string): Promise<string>;
}
