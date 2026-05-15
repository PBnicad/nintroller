import express from 'express';
import { join } from 'path';
import type { ControllerAPI, Button } from './plugins/types';
import type { Server } from 'http';
import { PluginManager } from './core/plugin-manager';

export async function startServer(port: number, api: ControllerAPI): Promise<Server> {
  const app = express();
  app.use(express.json());

  const pluginManager = new PluginManager(api);
  await pluginManager.discoverAll();

  const webDist = join(__dirname, '..', 'dist', 'web');
  app.use(express.static(webDist));

  app.get('/api/status', async (_req, res) => {
    try {
      const status = await api.getStatus();
      res.json(status);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/btn', async (req, res) => {
    try {
      const { button, duration } = req.body;
      const btn = (button as string).toUpperCase() as Button;
      await api.pressButton(btn, duration ?? 100);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/hold', async (req, res) => {
    try {
      const { button, duration } = req.body;
      const btn = (button as string).toUpperCase() as Button;
      await api.holdButton(btn, duration);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/tap', async (req, res) => {
    try {
      const { button, count } = req.body;
      const btn = (button as string).toUpperCase() as Button;
      await api.tapButton(btn, count);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/stick', async (req, res) => {
    try {
      const { side, x, y, duration } = req.body;
      await api.moveStick(side, x, y, duration ?? 200);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/wait', async (req, res) => {
    try {
      const { ms } = req.body;
      await api.wait(ms);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/send', async (req, res) => {
    try {
      const { command } = req.body;
      const result = await api.sendRaw(command);
      res.json({ success: true, response: result });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/seq/begin', async (_req, res) => {
    try {
      await api.beginSequence();
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/seq/play', async (_req, res) => {
    try {
      await api.playSequence();
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/seq/clear', async (_req, res) => {
    try {
      await api.clearSequence();
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/mode', async (req, res) => {
    try {
      await api.sendRaw(`MODE ${req.body.mode.toUpperCase()}`);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/plugin', (_req, res) => {
    const plugins = pluginManager.getLoadedPlugins().map((p) => ({
      name: p.name,
      version: p.version,
      description: p.description,
    }));
    res.json({ plugins });
  });

  app.get('/api/plugin/:name/commands', (req, res) => {
    const plugin = pluginManager.getPlugin(req.params.name);
    if (!plugin) {
      return res.status(404).json({ error: `plugin not found: ${req.params.name}` });
    }
    res.json({ commands: plugin.getCommands().map((c) => ({ name: c.name, description: c.description })) });
  });

  app.post('/api/plugin/:name/:command', async (req, res) => {
    const plugin = pluginManager.getPlugin(req.params.name);
    if (!plugin) {
      return res.status(404).json({ error: `plugin not found: ${req.params.name}` });
    }
    const cmd = plugin.getCommands().find((c) => c.name === req.params.command);
    if (!cmd) {
      return res.status(404).json({ error: `command not found: ${req.params.command}` });
    }
    try {
      await cmd.action(req.body.args ?? [], api);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('*', (_req, res) => {
    res.sendFile(join(webDist, 'index.html'));
  });

  return new Promise((resolve) => {
    const server = app.listen(port, () => resolve(server));
  });
}
