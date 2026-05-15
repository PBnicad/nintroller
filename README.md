# Nintroller

Nintendo Switch 自动化中间件平台 — 通过 ESP32-S3 模拟蓝牙手柄，上位机 CLI 操控 Switch。

```
nintroller connect COM3
nintroller btn A
nintroller stick L 1 0 500
```

## 架构

```
PC (CLI/插件) ──USB── ESP32-S3 ──Bluetooth── Nintendo Switch
       ↑                        ↑
   Node.js/TS              PlatformIO/C++
```

## 安装

```bash
pnpm add -g nintroller
```

前置条件：Node.js >= 18，ESP32-S3 需刷入 `firmware/` 固件。

## AI 使用

项目内置 [SKILL.md](./SKILL.md)，AI Agent 加载后可通过 CLI 直接操控 Switch。所有命令支持 `--json` 输出和标准化退出码，适合脚本与 Agent 消费：

```bash
nintroller connect COM3 --json
nintroller btn A --json
nintroller status --json
# → {"connected":true,"mode":"immediate","btConnected":true}
```

## CLI 命令

```bash
# 连接
nintroller connect <COM口>

# 配对（首次使用）
nintroller pair
# → 然后在 Switch 上：系统设置 → 控制器 → 更改握法/顺序

# 按键
nintroller btn A [duration]        # 按下 (默认100ms)
nintroller hold A 2000             # 长按
nintroller tap A 10                # 连按

# 摇杆
nintroller stick L -1 0 300        # 左摇杆向左300ms

# 序列
nintroller mode sequence
nintroller seq begin               # 开始录制
nintroller btn A 100
nintroller stick R 0 1 200
nintroller seq play                # 回放

# 系统
nintroller status                  # 查看状态
nintroller disconnect              # 断开连接

# 插件
nintroller plugin list             # 已加载插件
nintroller plugin run <plugin> <cmd> [args...]  # 运行插件命令
```

所有命令支持 `--json` 和 `--timeout <ms>`：

```bash
nintroller status --json
nintroller btn A --timeout 3000
```

## 退出码

| 码 | 含义 |
|----|------|
| 0 | 成功 |
| 1 | 参数错误 |
| 2 | 串口错误 |
| 3 | 超时 |
| 4 | ESP32 返回错误 |

## 开发

```bash
git clone <repo>
cd nintroller
pnpm install

# 开发模式（tsx 直接运行）
pnpm dev connect COM3

# 编译
pnpm build

# 类型检查
pnpm typecheck
```

### ESP32 固件

```bash
cd firmware
pio run              # 编译
pio run -t upload    # 烧录
```

## 插件开发

在 `plugins/<name>/` 下创建：

```
plugins/my-plugin/
├── package.json     # 含 "nintroller-plugin": { "main": "./index.js" }
└── index.ts         # 默认导出实现 INintrollerPlugin 的类
```

```typescript
import type { INintrollerPlugin, ControllerAPI, CommandDef } from 'nintroller';

export default class MyPlugin implements INintrollerPlugin {
  name = 'my-plugin';
  version = '1.0.0';
  description = '示例插件';

  async onLoad(api: ControllerAPI) {}
  async onUnload() {}

  getCommands(): CommandDef[] {
    return [{
      name: 'hello',
      description: '打个招呼',
      action: async (args, api) => {
        await api.pressButton('A', 100);
      },
    }];
  }
}
```

## Roadmap

| 版本 | 内容 | 状态 |
|------|------|------|
| **v0.1.0** | | **当前** |
| | ESP32 固件：蓝牙 HID Pro Controller 模拟 | ✓ |
| | 串口协议：文本行协议，immediate / sequence 双模式 | ✓ |
| | 上位机 CLI：connect / btn / hold / tap / stick / wait / mode / seq / plugin | ✓ |
| | 插件系统：发现、加载、CLI invoke | ✓ |
| | `--json` / `--timeout` 全局选项，标准化退出码 | ✓ |
| **v0.2.0** | | |
| | 摇杆精细控制：支持 -32768 ~ 32767 完整行程 | |
| | 序列编辑器 CLI（增删改查） | |
| | 固件 OTA 无线更新 | |
| | 串口自动重连 | |
| **v0.3.0** | Web GUI | |
| | Dashboard：连接状态、实时日志 | |
| | 虚拟手柄：可视化操控测试 | |
| | 序列编辑器：拖拽编辑 + 可视化回放 | |
| | 插件管理面板：安装、启用、禁用 | |
| | 插件自定义 Web 页面注册 | |
| **v1.0.0** | 示例 & 生态 | |
| | Splatoon3 画图示例插件 | |
| | 录制回放宏（按键宏录制 + 编辑 + 回放） | |
| | 插件市场 CLI（install / search） | |
| | 文档站 | |

## 技术栈

| 层 | 技术 |
|----|------|
| ESP32 固件 | C++17, PlatformIO, BlueDroid |
| 上位机 | TypeScript, Node.js, commander, serialport |
| Web GUI | React, TypeScript, Vite, Express |

## 致谢

本项目的 ESP32 固件蓝牙 HID 实现（`firmware/src/classic_bt_controller_transport.*`）参考了 **[Friend Maker](https://github.com/zhouxiyu1997/friendmaker)** 的 Switch Pro Controller 蓝牙模拟代码。

- **Friend Maker** 作者：[惜羽拓麻镇](https://github.com/zhouxiyu1997)（小红书同名）
- Friend Maker 蓝牙链路的思路与代码路径源自 **UARTSwitchCon**

感谢他们的开源贡献。

## License

[GPL-3.0-or-later](https://www.gnu.org/licenses/gpl-3.0.html) — 由于固件中包含 Friend Maker / UARTSwitchCon 的 GPL 衍生代码，本项目整体使用 GPL-3.0 保持许可证一致。
