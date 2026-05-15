# AGENTS.md — Nintroller 项目 AI 协作指南

## 项目概述

Nintroller 是一个 Nintendo Switch 自动化中间件平台，包含两部分：
1. **ESP32-S3 固件**（`firmware/`）— 模拟蓝牙手柄，通过串口接收命令操控 Switch
2. **上位机**（`src/`）— Node.js/TypeScript 中间件，插件架构，CLI + Web GUI

## 目录结构

```
nintroller/
├── firmware/                    # ESP32-S3 固件 (PlatformIO)
│   ├── platformio.ini
│   └── src/
│       ├── main.cpp
│       ├── protocol.h/cpp
│       ├── seq_buffer.h/cpp
│       ├── config.h
│       ├── controller_transport.h
│       ├── classic_bt_controller_transport.h/cpp
│       └── mock_controller_transport.h/cpp
├── src/                         # 上位机 Node.js/TypeScript
│   ├── cli.ts
│   ├── server.ts
│   ├── core/
│   │   ├── serial-bridge.ts
│   │   ├── controller.ts
│   │   └── plugin-manager.ts
│   ├── plugins/
│   │   └── types.ts
│   └── web/                    # React + Vite 前端
├── plugins/                    # 用户安装的第三方插件
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## 技术栈

| 层 | 技术 |
|----|------|
| ESP32 固件 | C++17, PlatformIO, Arduino + ESP-IDF, BlueDroid |
| 上位机后端 | TypeScript, Node.js, Express, commander, serialport |
| 上位机前端 | React, TypeScript, Vite |
| 包管理 | npm |

## 构建与运行

### ESP32 固件

```bash
# 编译
cd firmware && pio run

# 烧录
cd firmware && pio run -t upload

# 串口监控
cd firmware && pio device monitor -b 115200
```

### 上位机

```bash
# 安装依赖
npm install

# 开发模式（ts-node + vite dev）
npm run dev

# CLI 编译后运行
npm run build
nintroller connect COM3

# 启动 Web GUI
nintroller web

# Web GUI 开发模式
npm run web:dev

# 类型检查
npm run typecheck

# 测试
npm test
```

## 编码规范

### ESP32 固件 (C++)
- C++17 标准
- 遵循 Google C++ Style，4 空格缩进
- 类名 PascalCase，函数名 camelCase，常量 kConstantName
- 头文件使用 `#pragma once`
- 所有蓝牙 HID 操作通过 `ControllerTransport` 抽象接口
- 串口协议解析在 `protocol.cpp`，不散落在 main.cpp

### 上位机 (TypeScript)
- 严格模式 (`strict: true`)
- 使用 `async/await`，避免回调嵌套
- 文件命名：kebab-case（`serial-bridge.ts`）
- 导出优先 named export
- 类型定义与实现分离（`types.ts`）
- 所有串口命令发送必须有超时机制（默认 5000ms）

## 串口协议

- 波特率：115200
- 格式：文本行，`\n` 结尾
- 每个命令回复一行：`OK` / `ERR <msg>` / `QUEUED <N>` / `DONE <N>` / `SEQ COMPLETE`
- 发送命令后必须等待对应回复，超时 5 秒视为失败

## 插件开发

插件位于 `plugins/<name>/`，必须包含：
- `package.json` 含 `"nintroller-plugin": { "main": "./index.js" }`
- 导出一个实现 `INintrollerPlugin` 接口的类
- 参考：`src/plugins/types.ts`

## 参考代码

ESP32 蓝牙 HID 实现参考：`D:\friendmaker\firmware\esp32`
- `classic_bt_controller_transport.cpp` — 完整的 Pro Controller 蓝牙协议实现
- `controller_transport.h` — 按键枚举与抽象接口
- 连接状态机、HID 报告描述符均从此参考复用

## AI Agent 集成

### CLI 输出规范
- 所有命令支持全局 `--json` 标志，输出单行紧凑 JSON
- 退出码约定：`0` 成功 / `1` 参数错误 / `2` 串口错误 / `3` 超时 / `4` ESP32 错误
- 全局 `--timeout <ms>` 覆盖默认超时
- 所有命令无需交互式输入，适合管道与脚本调用

### opencode Skill
项目内置 AI 操作技能：`.opencode/skills/nintroller/SKILL.md`
当 opencode 加载此 skill 后，可直接通过 CLI 操控 Switch 完成：
- 通用按键/摇杆操控
- 序列录制与回放
- Splatoon3 画图等自动化任务

## 注意事项

- 固件只做命令转发，不包含游戏业务逻辑
- 上位机与 ESP32 之间掉线需自动重连
- 序列模式中，上位机需等待 `SEQ COMPLETE` 后才能发送下一条命令
- Web GUI 通过 Express 暴露 API，前端通过 fetch 调用本地接口
- 所有第三方插件运行在独立上下文中，异常不应影响主进程
