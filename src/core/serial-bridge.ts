import { SerialPort } from 'serialport';
import { ReadlineParser } from 'serialport';
import type { ESP32Status } from '../plugins/types';

export type CommandResult = {
  success: boolean;
  response: string;
};

export class SerialBridge {
  private port: SerialPort | null = null;
  private parser: ReadlineParser | null = null;
  private portName: string | null = null;
  private responseQueue: string[] = [];
  private resolveQueue: Array<(line: string) => void> = [];
  private mode: 'immediate' | 'sequence' = 'immediate';
  private seqSize = 0;
  private btConnected = false;
  private firmwareVersion = '?';

  get isConnected(): boolean {
    return this.port?.isOpen ?? false;
  }

  get currentPort(): string | null {
    return this.portName;
  }

  get currentMode(): 'immediate' | 'sequence' {
    return this.mode;
  }

  async connect(portName: string): Promise<void> {
    if (this.port?.isOpen) {
      await this.disconnect();
    }

    this.portName = portName;

    return new Promise((resolve, reject) => {
      this.port = new SerialPort({ path: portName, baudRate: 115200 }, (err) => {
        if (err) return reject(err);
        this.parser = this.port!.pipe(new ReadlineParser({ delimiter: '\n' }));
        this.parser.on('data', (line: string) => this.onLine(line.trim()));

        setTimeout(() => resolve(), 800);
      });
    });
  }

  async disconnect(): Promise<void> {
    if (this.port?.isOpen) {
      return new Promise((resolve) => {
        this.port!.close(() => {
          this.port = null;
          this.parser = null;
          resolve();
        });
      });
    }
  }

  async sendCommand(command: string, timeoutMs = 5000): Promise<CommandResult> {
    if (!this.port?.isOpen) {
      return { success: false, response: 'ERR not connected' };
    }

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        resolve({ success: false, response: 'ERR timeout' });
      }, timeoutMs);

      this.resolveQueue.push((line: string) => {
        clearTimeout(timer);

        // Parse sequence-specific responses
        if (line.startsWith('QUEUED ')) {
          const n = parseInt(line.substring(7), 10);
          if (!isNaN(n)) this.seqSize = n;
        } else if (line.startsWith('DONE ') || line === 'SEQ COMPLETE') {
          // Sequence progress, pass through
        } else if (line.startsWith('INFO bt_connected=')) {
          this.btConnected = line.includes('true');
        }

        if (line.startsWith('OK') || line.startsWith('QUEUED') ||
            line.startsWith('DONE') || line === 'SEQ COMPLETE') {
          resolve({ success: true, response: line });
        } else if (line.startsWith('ERR')) {
          resolve({ success: false, response: line });
        } else {
          resolve({ success: true, response: line });
        }
      });

      this.port!.write(command + '\n', (err) => {
        if (err) {
          clearTimeout(timer);
          resolve({ success: false, response: 'ERR write failed: ' + err.message });
        }
      });
    });
  }

  async sendAndWait(command: string, timeoutMs = 5000): Promise<string> {
    const result = await this.sendCommand(command, timeoutMs);
    if (!result.success) throw new Error(result.response);
    return result.response;
  }

  async queryInfo(): Promise<ESP32Status> {
    const resp = await this.sendAndWait('INFO');
    return this.parseStatus(resp);
  }

  async setMode(mode: 'immediate' | 'sequence'): Promise<void> {
    await this.sendAndWait(`MODE ${mode.toUpperCase()}`);
    this.mode = mode;
    this.seqSize = 0;
  }

  async sequenceBegin(): Promise<void> {
    await this.sendAndWait('SEQ BEGIN');
    this.seqSize = 0;
  }

  async sequencePlay(): Promise<void> {
    await this.sendAndWait('SEQ PLAY', 60000);
  }

  async sequenceClear(): Promise<void> {
    await this.sendAndWait('SEQ CLEAR');
    this.seqSize = 0;
  }

  getStatus(): ESP32Status {
    return {
      connected: this.isConnected,
      port: this.portName,
      mode: this.mode,
      firmware: this.firmwareVersion,
      btConnected: this.btConnected,
      sequenceSize: this.seqSize,
      sequenceCapacity: 1024,
    };
  }

  private parseStatus(raw: string): ESP32Status {
    const firmware = extractField(raw, 'firmware=') ?? '?';
    const modeStr = extractField(raw, 'mode=') ?? 'immediate';
    const seqStr = extractField(raw, 'seq=') ?? '0/1024';
    const [seqSizeStr] = seqStr.split('/');
    const btStr = extractField(raw, 'bt_connected=') ?? 'false';

    this.firmwareVersion = firmware;

    return {
      connected: this.isConnected,
      port: this.portName,
      mode: modeStr as 'immediate' | 'sequence',
      firmware,
      btConnected: btStr === 'true',
      sequenceSize: parseInt(seqSizeStr, 10) || 0,
      sequenceCapacity: 1024,
    };
  }

  private onLine(line: string): void {
    if (line.startsWith('BOOT ')) {
      this.firmwareVersion = extractField(line, 'version=') ?? '?';
      return;
    }
    if (line.startsWith('INFO bt_connected=')) {
      this.btConnected = line.includes('true');
    }

    const resolver = this.resolveQueue.shift();
    if (resolver) {
      resolver(line);
    }
  }
}

function extractField(line: string, prefix: string): string | null {
  const idx = line.indexOf(prefix);
  if (idx < 0) return null;
  const start = idx + prefix.length;
  const end = line.indexOf(' ', start);
  return end < 0 ? line.substring(start) : line.substring(start, end);
}
