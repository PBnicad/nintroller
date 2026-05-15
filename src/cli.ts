#!/usr/bin/env node
import { Command } from 'commander';
import { SerialBridge } from './core/serial-bridge';
import { Controller } from './core/controller';
import { PluginManager } from './core/plugin-manager';
import type { Button } from './plugins/types';

interface GlobalOptions {
  json?: boolean;
  timeout?: string;
}

const program = new Command();
let bridge: SerialBridge | null = null;
let controller: Controller | null = null;
let pluginManager: PluginManager | null = null;

function getController(): Controller {
  if (!bridge) {
    bridge = new SerialBridge();
    controller = new Controller(bridge);
  }
  return controller!;
}

function getPluginManager(): PluginManager {
  if (!pluginManager) {
    pluginManager = new PluginManager(getController());
  }
  return pluginManager;
}

function output(data: unknown, opts: GlobalOptions): void {
  if (opts.json) {
    console.log(JSON.stringify(data));
  } else if (typeof data === 'string') {
    console.log(data);
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
}

function outputError(msg: string, opts: GlobalOptions): void {
  output({ error: msg }, opts);
}

const BUTTONS: Button[] = [
  'A', 'B', 'X', 'Y', 'L', 'R', 'ZL', 'ZR',
  'PLUS', 'MINUS', 'HOME', 'CAPTURE', 'LS', 'RS',
  'UP', 'DOWN', 'LEFT', 'RIGHT',
];

program
  .name('nintroller')
  .description('Nintendo Switch automation middleware')
  .version('0.1.0')
  .option('--json', 'output as JSON')
  .option('--timeout <ms>', 'command timeout in ms', '5000');

// ── connect ──────────────────────────────────────────────
program
  .command('connect <port>')
  .description('Connect to ESP32 on serial port')
  .action(async (port: string, opts: GlobalOptions) => {
    try {
      const ctrl = getController();
      await ctrl.getBridge().connect(port);
      const status = await ctrl.getStatus();
      output({ success: true, port, status }, opts);
    } catch (err: any) {
      outputError(err.message, opts);
      process.exit(2);
    }
  });

// ── disconnect ───────────────────────────────────────────
program
  .command('disconnect')
  .description('Disconnect from ESP32')
  .action(async () => {
    const opts = program.opts() as GlobalOptions;
    try {
      const ctrl = getController();
      await ctrl.getBridge().disconnect();
      output({ success: true }, opts);
    } catch (err: any) {
      outputError(err.message, opts);
      process.exit(2);
    }
  });

// ── status ───────────────────────────────────────────────
program
  .command('status')
  .description('Show ESP32 status')
  .action(async () => {
    const opts = program.opts() as GlobalOptions;
    try {
      const ctrl = getController();
      const status = await ctrl.getStatus();
      if (!status.connected) {
        output({ connected: false, port: null }, opts);
        return;
      }
      output(status, opts);
    } catch (err: any) {
      outputError(err.message, opts);
      process.exit(2);
    }
  });

// ── send ─────────────────────────────────────────────────
program
  .command('send <raw...>')
  .description('Send raw command to ESP32')
  .action(async (raw: string[]) => {
    const opts = program.opts() as GlobalOptions;
    try {
      const ctrl = getController();
      const command = raw.join(' ');
      const result = await ctrl.sendRaw(command);
      output({ success: true, command, response: result }, opts);
    } catch (err: any) {
      outputError(err.message, opts);
      process.exit(4);
    }
  });

// ── btn ──────────────────────────────────────────────────
program
  .command('btn <button> [duration]')
  .description('Press a button (A/B/X/Y/L/R/ZL/ZR/PLUS/MINUS/HOME/CAPTURE/LS/RS/UP/DOWN/LEFT/RIGHT)')
  .action(async (button: string, duration: string | undefined) => {
    const opts = program.opts() as GlobalOptions;
    try {
      const ctrl = getController();
      const btn = button.toUpperCase() as Button;
      if (!BUTTONS.includes(btn)) {
        outputError(`unknown button: ${button}`, opts);
        process.exit(1);
      }
      const dur = duration ? parseInt(duration, 10) : 100;
      await ctrl.pressButton(btn, dur);
      output({ success: true, command: `BTN ${btn} ${dur}` }, opts);
    } catch (err: any) {
      outputError(err.message, opts);
      process.exit(4);
    }
  });

// ── hold ─────────────────────────────────────────────────
program
  .command('hold <button> <duration>')
  .description('Hold a button for duration in ms')
  .action(async (button: string, duration: string) => {
    const opts = program.opts() as GlobalOptions;
    try {
      const ctrl = getController();
      const btn = button.toUpperCase() as Button;
      if (!BUTTONS.includes(btn)) {
        outputError(`unknown button: ${button}`, opts);
        process.exit(1);
      }
      const dur = parseInt(duration, 10);
      await ctrl.holdButton(btn, dur);
      output({ success: true, command: `HOLD ${btn} ${dur}` }, opts);
    } catch (err: any) {
      outputError(err.message, opts);
      process.exit(4);
    }
  });

// ── tap ──────────────────────────────────────────────────
program
  .command('tap <button> <count>')
  .description('Tap a button multiple times')
  .action(async (button: string, count: string) => {
    const opts = program.opts() as GlobalOptions;
    try {
      const ctrl = getController();
      const btn = button.toUpperCase() as Button;
      if (!BUTTONS.includes(btn)) {
        outputError(`unknown button: ${button}`, opts);
        process.exit(1);
      }
      const cnt = parseInt(count, 10);
      await ctrl.tapButton(btn, cnt);
      output({ success: true, command: `TAP ${btn} ${cnt}` }, opts);
    } catch (err: any) {
      outputError(err.message, opts);
      process.exit(4);
    }
  });

// ── stick ────────────────────────────────────────────────
program
  .command('stick <side> <x> <y> [duration]')
  .description('Move analog stick (L/R, x/y: -1/0/1)')
  .action(async (side: string, x: string, y: string, duration: string | undefined) => {
    const opts = program.opts() as GlobalOptions;
    try {
      const ctrl = getController();
      const s = side.toUpperCase() as 'L' | 'R';
      if (s !== 'L' && s !== 'R') {
        outputError('side must be L or R', opts);
        process.exit(1);
      }
      const sx = parseInt(x, 10);
      const sy = parseInt(y, 10);
      const dur = duration ? parseInt(duration, 10) : 200;
      await ctrl.moveStick(s, sx, sy, dur);
      output({ success: true, command: `STICK ${s} ${sx} ${sy} ${dur}` }, opts);
    } catch (err: any) {
      outputError(err.message, opts);
      process.exit(4);
    }
  });

// ── wait ─────────────────────────────────────────────────
program
  .command('wait <ms>')
  .description('Wait for milliseconds')
  .action(async (ms: string) => {
    const opts = program.opts() as GlobalOptions;
    try {
      const ctrl = getController();
      const dur = parseInt(ms, 10);
      await ctrl.wait(dur);
      output({ success: true, command: `WAIT ${dur}` }, opts);
    } catch (err: any) {
      outputError(err.message, opts);
      process.exit(4);
    }
  });

// ── mode ─────────────────────────────────────────────────
program
  .command('mode <mode>')
  .description('Switch mode (immediate | sequence)')
  .action(async (mode: string) => {
    const opts = program.opts() as GlobalOptions;
    try {
      const ctrl = getController();
      const m = mode.toLowerCase();
      if (m !== 'immediate' && m !== 'sequence') {
        outputError('mode must be immediate or sequence', opts);
        process.exit(1);
      }
      if (m === 'sequence') {
        await ctrl.getBridge().setMode('sequence');
      } else {
        await ctrl.getBridge().setMode('immediate');
      }
      output({ success: true, mode: m }, opts);
    } catch (err: any) {
      outputError(err.message, opts);
      process.exit(4);
    }
  });

// ── pair ─────────────────────────────────────────────────
program
  .command('pair')
  .description('Enter Bluetooth pairing mode (forgets previous pairings)')
  .action(async () => {
    const opts = program.opts() as GlobalOptions;
    try {
      const ctrl = getController();
      await ctrl.pair();
      output({ success: true, message: 'Pairing mode entered. Go to Switch Settings → Controllers → Change Grip/Order' }, opts);
    } catch (err: any) {
      outputError(err.message, opts);
      process.exit(4);
    }
  });

// ── seq ──────────────────────────────────────────────────
const seqCmd = program.command('seq').description('Sequence operations');

seqCmd
  .command('begin')
  .description('Begin recording sequence')
  .action(async () => {
    const opts = program.opts() as GlobalOptions;
    try { await getController().beginSequence(); output({ success: true, action: 'seq begin' }, opts); }
    catch (err: any) { outputError(err.message, opts); process.exit(4); }
  });

seqCmd
  .command('play')
  .description('Play recorded sequence')
  .action(async () => {
    const opts = program.opts() as GlobalOptions;
    try { await getController().playSequence(); output({ success: true, action: 'seq play' }, opts); }
    catch (err: any) { outputError(err.message, opts); process.exit(4); }
  });

seqCmd
  .command('clear')
  .description('Clear sequence buffer')
  .action(async () => {
    const opts = program.opts() as GlobalOptions;
    try { await getController().clearSequence(); output({ success: true, action: 'seq clear' }, opts); }
    catch (err: any) { outputError(err.message, opts); process.exit(4); }
  });

// ── web (pending frontend dev) ────────────────────────────
// program
//   .command('web [port]')
//   .description('Start Web GUI server')
//   .action(async (port: string | undefined) => { ... });

// ── plugin ───────────────────────────────────────────────
const pluginCmd = program.command('plugin').description('Plugin management');

pluginCmd
  .command('list')
  .description('List loaded plugins')
  .action(async () => {
    const opts = program.opts() as GlobalOptions;
    const mgr = getPluginManager();
    await mgr.discoverAll();
    const plugins = mgr.getLoadedPlugins().map((p) => ({
      name: p.name,
      version: p.version,
      description: p.description,
    }));
    output({ plugins }, opts);
  });

pluginCmd
  .command('run <pluginName> <commandName> [args...]')
  .description('Run a plugin command')
  .action(async (pluginName: string, commandName: string, args: string[]) => {
    const opts = program.opts() as GlobalOptions;
    const mgr = getPluginManager();
    let plugin = mgr.getPlugin(pluginName);
    if (!plugin) {
      await mgr.discoverAll();
      plugin = mgr.getPlugin(pluginName);
    }
    if (!plugin) {
      outputError(`plugin not found: ${pluginName}`, opts);
      process.exit(1);
    }
    const cmd = plugin.getCommands().find((c) => c.name === commandName);
    if (!cmd) {
      const cmds = plugin.getCommands().map((c) => c.name).join(', ');
      outputError(`unknown command: ${commandName}. Available: ${cmds}`, opts);
      process.exit(1);
    }
    try {
      await cmd.action(args, getController());
      output({ success: true, plugin: pluginName, command: commandName }, opts);
    } catch (err: any) {
      outputError(err.message, opts);
      process.exit(4);
    }
  });

program.parse();
