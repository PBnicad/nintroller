---
name: nintroller
description: Nintendo Switch automation via CLI — press buttons, move sticks, record/play sequences, run plugins. Requires ESP32-S3 with nintroller firmware connected via USB-UART.
license: GPL-3.0-or-later
compatibility: opencode
metadata:
  repository: https://github.com/pbnicad/nintroller
  npm: nintroller
---
# Nintroller Skill — AI 操控 Nintendo Switch

## 概述

通过 `nintroller` CLI 操控 Nintendo Switch。前提：ESP32-S3 已 USB 连接 PC 并刷入固件，且已蓝牙配对目标 Switch。

## 核心原则

- **所有命令加 `--json`**，输出便于解析的单行 JSON
- **每条命令后检查退出码**，非 0 即为失败
- `--timeout <ms>` 可覆盖默认超时（5000ms）
- 无交互式输入，适合管道与脚本调用

## 前置检查

### 首次配对

```bash
nintroller connect COM3 --json
nintroller pair --json                  # 清除旧绑定，进入可被发现模式
# 然后在 Switch 上：系统设置 → 控制器 → 更改握法/顺序
```

配对成功后可通过 `status` 确认 `btConnected: true`。

### 重新连接

```bash
# 连接并确认状态
nintroller connect COM3 --json
nintroller status --json
# → {"connected":true,"port":"COM3","mode":"immediate","btConnected":true,...}
```

若 `connected: false` 或 `btConnected: false`，检查串口占用或 Switch 蓝牙配对状态。

## 命令参考

### 连接管理

```bash
nintroller connect <port>              # 连接串口
nintroller disconnect                  # 断开
nintroller pair                        # 进入配对模式（清除旧绑定）
nintroller status --json               # 查看状态
```

配对流程：`connect` → `pair` → Switch 端进入「更改握法/顺序」→ 等待配对 → `status` 确认 `btConnected: true`。

### 模式

```bash
nintroller mode immediate --json       # 即时模式（逐条执行）
nintroller mode sequence --json        # 序列模式（缓冲→回放）
```

### 按键

按键名：`A B X Y L R ZL ZR PLUS MINUS HOME CAPTURE LS RS UP DOWN LEFT RIGHT`

```bash
nintroller btn A --json                # 按下 A，默认 100ms
nintroller btn A 500 --json            # 按下 A，持续 500ms
nintroller hold HOME 2000 --json       # 长按 HOME 2 秒（按下→等待→释放）
nintroller tap A 3 --json              # 连按 A 3 次
```

> `hold` 是原子操作（按下→等待→释放），不支持"按住不放再叠加另一个键"。需同时多键时，在序列模式下组合多条 `btn`。

### 摇杆

摇杆值取 `-1` / `0` / `1`，默认持续 200ms：

```bash
nintroller stick L 0 -1 500 --json     # 左摇杆上推 500ms
nintroller stick R 1 0 300 --json      # 右摇杆右推 300ms
nintroller stick L 0 0 100 --json      # 左摇杆回中
```

### 等待

```bash
nintroller wait 1000 --json            # 纯等待 1 秒
```

### 原始命令

```bash
nintroller send "BTN A 200" --json     # 直接发送协议文本到 ESP32
```

### 序列录制与回放

```bash
nintroller mode sequence --json
nintroller seq begin --json            # 开始缓冲
# 添加动作（每条返回 QUEUED <N>）
nintroller btn A 100 --json
nintroller wait 50 --json
nintroller stick L 0 -1 200 --json
nintroller btn A 100 --json
nintroller seq play --json             # 回放（DONE 1 → 2 → ... → SEQ COMPLETE）
nintroller seq clear --json            # 丢弃未回放的缓冲区
```

### 插件

```bash
nintroller plugin list --json                    # 列出已加载插件（自动发现）
nintroller plugin run <name> <cmd> [args...] --json  # 运行插件命令
```

## 退出码

| 码 | 含义 | 应对 |
|----|------|------|
| 0 | 成功 | 继续 |
| 1 | 参数错误 | 检查命令拼写和参数值 |
| 2 | 串口错误 | 尝试 `nintroller connect` 重连 |
| 3 | 超时 | 增加 `--timeout` 或检查 ESP32 |
| 4 | ESP32 错误 | 查看错误信息，可能需要 `nintroller send INFO` |

## 典型工作流

### 导航菜单

```bash
nintroller connect COM3 --json
nintroller btn HOME 500 --json         # 唤醒/回主页
nintroller wait 2000                   # 等待
nintroller stick L 1 0 200 --json      # 右移
nintroller stick L 1 0 200 --json      # 再右移
nintroller btn A --json                # 确认
```

### Splatoon3 画图（序列模式）

在广场邮箱投稿画面，光标位于网格起点后：

```bash
nintroller mode sequence --json
nintroller seq begin --json
# 绘制 5 格横线
nintroller btn A 100 --json            # 在当前格画一笔
nintroller stick L 1 0 80 --json       # 右移一格
nintroller btn A 100 --json
nintroller stick L 1 0 80 --json
nintroller btn A 100 --json
nintroller seq play --json             # 逐帧回放
```

### 错误处理模式

```bash
nintroller connect COM3 --json
if [ $? -ne 0 ]; then
  echo "连接失败，检查串口"
  exit 2
fi

nintroller btn A 100 --timeout 8000 --json
```

## 故障排查

### 无法连接

- 确认 ESP32 未被其他软件占用串口
- 确认波特率为 115200

### 蓝牙未连接

```bash
nintroller status --json
# btConnected: false → 检查：
# 1. ESP32 是否在 Switch「控制器 → 更改握法/顺序」配对列表
# 2. Switch 是否处于可配对状态
```

### 序列播放中断

```bash
nintroller connect COM3 --json
nintroller seq clear --json            # 清空残留
nintroller seq begin --json            # 重新录制
```
