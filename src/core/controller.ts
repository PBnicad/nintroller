import { SerialBridge } from './serial-bridge';
import type { ControllerAPI, Button, ESP32Status, ControllerAction } from '../plugins/types';

export class Controller implements ControllerAPI {
  constructor(private bridge: SerialBridge) {}

  async pressButton(btn: Button, durationMs = 100): Promise<void> {
    await this.bridge.sendAndWait(`BTN ${btn} ${durationMs}`);
  }

  async holdButton(btn: Button, durationMs: number): Promise<void> {
    await this.bridge.sendAndWait(`HOLD ${btn} ${durationMs}`);
  }

  async tapButton(btn: Button, count: number): Promise<void> {
    for (let i = 0; i < count; i++) {
      await this.pressButton(btn);
    }
  }

  async moveStick(side: 'L' | 'R', x: number, y: number, durationMs = 200): Promise<void> {
    const sx = Math.max(-1, Math.min(1, x));
    const sy = Math.max(-1, Math.min(1, y));
    await this.bridge.sendAndWait(`STICK ${side} ${sx} ${sy} ${durationMs}`);
  }

  async wait(ms: number): Promise<void> {
    await this.bridge.sendAndWait(`WAIT ${ms}`);
  }

  async beginSequence(): Promise<void> {
    await this.bridge.setMode('sequence');
    await this.bridge.sequenceBegin();
  }

  async addToSequence(action: ControllerAction): Promise<void> {
    switch (action.type) {
      case 'btn':
        await this.bridge.sendAndWait(`BTN ${action.button} ${action.duration}`);
        break;
      case 'hold':
        await this.bridge.sendAndWait(`HOLD ${action.button} ${action.duration}`);
        break;
      case 'stick':
        await this.bridge.sendAndWait(
          `STICK ${action.stickSide} ${action.stickX} ${action.stickY} ${action.duration}`
        );
        break;
      case 'wait':
        await this.bridge.sendAndWait(`WAIT ${action.duration}`);
        break;
    }
  }

  async playSequence(): Promise<void> {
    await this.bridge.sequencePlay();
    await this.bridge.setMode('immediate');
  }

  async clearSequence(): Promise<void> {
    await this.bridge.sequenceClear();
  }

  async pair(): Promise<void> {
    await this.bridge.pair();
  }

  async getStatus(): Promise<ESP32Status> {
    return await this.bridge.queryInfo();
  }

  async sendRaw(command: string): Promise<string> {
    return await this.bridge.sendAndWait(command);
  }

  getBridge(): SerialBridge {
    return this.bridge;
  }
}
