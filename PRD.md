# Nintroller — Nintendo Switch 自动化平台 PRD

## 1. 产品概述

Nintroller 是一个 Nintendo Switch 自动化中间件平台。通过 ESP32-S3 模拟蓝牙手柄连接 Switch，上位机（PC）通过 USB 串口控制 ESP32，实现对 Switch 的自动化操控。平台采用插件架构，支持后期扩展不同游戏场景的自动化功能（如 Splatoon3 自动画图）。

## 2. 系统架构

```
┌─────────────────────────────────────────────────────┐
│  上位机 (nintroller-host) — Node.js + TypeScript    │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   CLI    │  │ Plugin Manager│  │  Web GUI      │  │
│  │ commander│  │ 插件发现/加载  │  │ React + Vite  │  │
│  └────┬─────┘  └──────┬───────┘  └──────┬───────┘  │
│       └───────────────┼─────────────────┘           │
│                       ▼                              │
│              ┌────────────────┐                      │
│              │ ControllerAPI  │  统一控制接口         │
│              └───────┬────────┘                      │
│                      ▼                               │
│              ┌────────────────┐                      │
│              │ Serial Bridge  │  串口通信 + 协议     │
│              └───────┬────────┘                      │
└──────────────────────┼──────────────────────────────┘
                       │  USB-UART (115200 baud)
                       ▼
┌──────────────────────────────────────────────────────┐
│  ESP32-S3 (nintroller-firmware) — C++ / PlatformIO   │
│  ┌─────────────────────────────────────────────┐     │
│  │           Protocol Parser                   │     │
│  │  ┌───────────────┐  ┌──────────────────┐    │     │
│  │  │ Immediate Mode │  │ Sequence Mode    │    │     │
│  │  │ 收到即执行      │  │ 缓冲→提交→播放   │    │     │
│  │  └───────┬───────┘  └────────┬─────────┘    │     │
│  └──────────┼───────────────────┼──────────────┘     │
│             ▼                   ▼                     │
│  ┌─────────────────────────────────────────────┐     │
│  │   ClassicBtControllerTransport              │     │
│  │   BlueDroid HID — Pro Controller 模拟       │     │
│  └────────────────────┬────────────────────────┘     │
└───────────────────────┼──────────────────────────────┘
                        │  Bluetooth Classic (BR/EDR)
                        ▼
                 ┌──────────────┐
                 │ Nintendo Switch│
                 └──────────────┘
```

## 3. ESP32 固件规格

### 3.1 硬件
- 芯片：ESP32-S3
- 构建系统：PlatformIO (Arduino + ESP-IDF)
- 蓝牙栈：ESP-IDF BlueDroid (Classic BR/EDR)
- 模拟设备：Nintendo Switch Pro Controller

### 3.2 两种运行模式

| 模式 | 行为 | 适用场景 |
|------|------|----------|
| **Immediate** (默认) | 上位机发一条 → ESP32 立即执行并蓝牙发送 | 手动操控、实时响应 |
| **Sequence** | 上位机发多條缓冲 → 发 PLAY 后逐条播放 | 精确时序的自动化序列（画图） |

### 3.3 序列缓冲区
- 容量：1024 条命令
- 命令结构：类型 + 持续时间 + 参数
- 播放时每条命令完成后回复 `DONE <N>`
- 全部完成后回复 `SEQ COMPLETE`

### 3.4 串口协议

- 物理层：USB-UART，115200 baud
- 数据格式：文本行，换行符 `\n` 分隔
- 应答：每條命令回复 `OK` / `ERR <msg>` / `QUEUED <N>` / `DONE <N>`

### 3.5 命令集

```
系统：
  MODE IMMEDIATE|SEQUENCE    切换模式
  INFO                       查询连接状态、当前模式、序列缓冲区使用量
  RESET                      重置蓝牙连接

按键：
  BTN <name> [dur_ms]        按下按钮（A/B/X/Y/L/R/ZL/ZR/+/−/HOME/CAPTURE/LS/RS/DUP/DDOWN/DLEFT/DRIGHT）
  HOLD <name> <dur_ms>       长按按钮
  TAP <name> <count>         连按按钮

摇杆：
  STICK L <x> <y> [dur_ms]   左摇杆（x/y: -1/0/1）
  STICK R <x> <y> [dur_ms]   右摇杆（x/y: -1/0/1）

等待：
  WAIT <ms>                  延迟等待

序列：
  SEQ BEGIN                  开始缓冲
  SEQ PLAY                   播放缓冲区
  SEQ CLEAR                  清空缓冲区
```

## 4. 上位机规格

### 4.1 技术栈
- 语言：TypeScript
- 运行时：Node.js
- 串口通信：serialport
- CLI 框架：commander
- Web 服务：Express
- Web 前端：React + Vite

### 4.2 核心模块

| 模块 | 职责 |
|------|------|
| `serial-bridge.ts` | 串口连接管理、命令发送、ACK 等待、超时重试 |
| `controller.ts` | ControllerAPI：封裝所有操控动作为 Promise 接口 |
| `plugin-manager.ts` | 扫描插件目录、加载/卸载插件、生命周期管理 |
| `cli.ts` | CLI 入口，注册内置命令和插件命令 |

### 4.3 CLI 命令

```
nintroller connect <port>              连接 ESP32
nintroller disconnect                  断开连接
nintroller status                      查看状态
nintroller send <raw-command>          发送原始命令
nintroller btn <name> [dur]            按下按钮
nintroller mode <immediate|sequence>   切换模式
nintroller seq begin|play|clear        序列控制
nintroller web [port]                  启动 Web GUI
nintroller plugin list|install|run     插件管理
```

所有命令均支持 `--json` 标志，输出结构化 JSON 以适应 AI Agent 消费：
```bash
nintroller status --json
# {"connected":true,"port":"COM3","mode":"immediate","firmware":"1.0.0","btStatus":"connected"}

nintroller btn A 200 --json
# {"success":true,"command":"BTN A 200","response":"OK","elapsedMs":215}
```

### 4.4 AI Agent 友好设计

| 特性 | 说明 |
|------|------|
| `--json` | 所有命令支持 JSON 输出，单行紧凑格式 |
| 退出码 | 0 = 成功，1 = 参数错误，2 = 串口错误，3 = 超时，4 = ESP32 返回错误 |
| `--timeout <ms>` | 自定义命令超时（默认 5000ms） |
| 无交互模式 | 所有操作无需终端提示，可管道调用 |
| `--dry-run` | 仅验证参数不实际执行（调试用） |
| opencode skill | 项目内置 `.opencode/skills/nintroller/SKILL.md`，AI 可直接加载调用 |

### 4.4 Web GUI 页面

| 页面 | 功能 |
|------|------|
| Dashboard | 连接状态、固件信息、实时日志 |
| Gamepad | 虚拟手柄，可视化操控测试 |
| Sequence Editor | 序列录制、编辑、回放 |
| Plugins | 插件列表、安装、启用/禁用 |
| Plugin Panel | 每个插件可注册自定义页面 |

## 5. 插件系统

### 5.1 插件接口

```typescript
interface INintrollerPlugin {
  name: string;
  version: string;
  description: string;

  onLoad(api: ControllerAPI): Promise<void>;
  onUnload(): Promise<void>;

  getCommands(): CommandDef[];
  getWebRoutes?(): WebRouteDef[];
}
```

### 5.2 插件发现
- 扫描 `plugins/` 目录下的每个子目录
- 每个插件需包含 `package.json`（含 `nintroller-plugin` 字段）
- 主入口为 `index.js`（编译后）或 `index.ts`（开发模式）

### 5.3 ControllerAPI（插件可用接口）

```typescript
interface ControllerAPI {
  pressButton(btn: Button, durationMs?: number): Promise<void>;
  moveStick(stick: 'L' | 'R', x: number, y: number, durationMs?: number): Promise<void>;
  holdButton(btn: Button, durationMs: number): Promise<void>;
  tapButton(btn: Button, count: number): Promise<void>;
  wait(ms: number): Promise<void>;

  beginSequence(): Promise<void>;
  addToSequence(cmd: ControllerAction): Promise<void>;
  playSequence(): Promise<void>;
  clearSequence(): Promise<void>;

  getStatus(): Promise<ESP32Status>;
  getSerialBridge(): SerialBridge;
}
```

## 6. 开发阶段

| 阶段 | 内容 | 交付物 |
|------|------|--------|
| P1 | ESP32 固件：蓝牙 HID + 双模式 + 协议解析 | 可刷写固件 |
| P2 | 上位机串口层 + ControllerAPI | 基础 CLI 可操控 Switch |
| P3 | CLI 完整命令 + 插件系统 | 插件可加载运行 |
| P4 | Web GUI 管理面板 | 浏览器可视化操控 |
| P5 | Splatoon3 画图示例插件 | 端到端验证 |

## 7. 设计原则

- **命令无状态**：每条命令独立，固件不关心上位机业务逻辑
- **业务在上位机**：画图算法、游戏逻辑全部由上位机/插件处理
- **固件只做转发**：接收串口命令 → 转化为蓝牙 HID 报告 → 发送
- **插件是一等公民**：所有游戏自动化功能均以插件形式存在
