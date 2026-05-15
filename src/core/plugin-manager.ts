import { existsSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';
import type { ControllerAPI, INintrollerPlugin } from '../plugins/types';

interface LoadedPlugin {
  instance: INintrollerPlugin;
  path: string;
}

export class PluginManager {
  private plugins = new Map<string, LoadedPlugin>();
  private pluginDirs: string[] = [];

  constructor(private api: ControllerAPI) {
    this.pluginDirs = [
      resolve(join(__dirname, '..', '..', 'plugins')),
      resolve(join(__dirname, '..', 'plugins')),
    ];
  }

  addPluginDir(dir: string): void {
    if (!this.pluginDirs.includes(dir)) {
      this.pluginDirs.push(dir);
    }
  }

  async discover(): Promise<string[]> {
    const found: string[] = [];
    for (const dir of this.pluginDirs) {
      if (!existsSync(dir)) continue;
      for (const entry of readdirSync(dir)) {
        const pluginDir = join(dir, entry);
        if (!statSync(pluginDir).isDirectory()) continue;
        const pkgPath = join(pluginDir, 'package.json');
        if (!existsSync(pkgPath)) continue;
        const pkg = require(pkgPath);
        if (pkg['nintroller-plugin']) {
          found.push(pluginDir);
        }
      }
    }
    return found;
  }

  async discoverAll(): Promise<void> {
    const found = await this.discover();
    for (const pluginDir of found) {
      const pkg = require(join(pluginDir, 'package.json'));
      const name = pkg.name ?? pluginDir.split(/[\\/]/).pop();
      if (!this.plugins.has(name)) {
        await this.load(pluginDir);
      }
    }
  }

  async load(pluginPath: string): Promise<void> {
    const pkg = require(join(pluginPath, 'package.json'));
    const mainFile = pkg['nintroller-plugin']?.main ?? './index.js';
    const mainPath = join(pluginPath, mainFile);
    const mod = require(mainPath);
    const PluginClass = mod.default ?? mod;
    const instance: INintrollerPlugin = new PluginClass();

    await instance.onLoad(this.api);
    this.plugins.set(instance.name, { instance, path: pluginPath });
  }

  async unload(name: string): Promise<void> {
    const loaded = this.plugins.get(name);
    if (!loaded) return;
    await loaded.instance.onUnload();
    this.plugins.delete(name);
  }

  async unloadAll(): Promise<void> {
    for (const name of this.plugins.keys()) {
      await this.unload(name);
    }
  }

  getLoadedPlugins(): INintrollerPlugin[] {
    return Array.from(this.plugins.values()).map((p) => p.instance);
  }

  getPlugin(name: string): INintrollerPlugin | undefined {
    return this.plugins.get(name)?.instance;
  }

  getAllCommands(): Array<{ plugin: string; command: ReturnType<INintrollerPlugin['getCommands']>[0] }> {
    const result: Array<{
      plugin: string;
      command: ReturnType<INintrollerPlugin['getCommands']>[0];
    }> = [];
    for (const [name, loaded] of this.plugins) {
      for (const cmd of loaded.instance.getCommands()) {
        result.push({ plugin: name, command: cmd });
      }
    }
    return result;
  }
}
