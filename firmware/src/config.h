#pragma once

#include <Arduino.h>

// ── Serial ──────────────────────────────────────────────
constexpr uint32_t SERIAL_BAUD_RATE = 115200;

// ── Input timing defaults ───────────────────────────────
constexpr uint16_t HID_REPEAT_INTERVAL_MS = 16;
constexpr uint16_t HID_SEND_REPORT_TIMEOUT_MS = 400;
constexpr uint16_t INPUT_DELAY_MS = 100;
constexpr uint16_t BUTTON_PRESS_DURATION_MS = 100;
constexpr uint16_t STICK_DURATION_MS = 200;

// ── Sequence buffer ─────────────────────────────────────
constexpr uint16_t SEQ_CAPACITY = 1024;

// ── Firmware identity ───────────────────────────────────
constexpr char FIRMWARE_NAME[] = "nintroller";
constexpr char FIRMWARE_VERSION[] = "0.1.0";
constexpr char BOARD_FAMILY[] = "esp32-s3";

// ── Bluetooth identity (Nintendo Pro Controller) ────────
constexpr char BT_DEVICE_NAME[] = "Pro Controller";
constexpr char BT_DEVICE_PROVIDER[] = "Nintendo";
constexpr char BT_DEVICE_DESCRIPTION[] = "Gamepad";
constexpr uint8_t BT_PAIR_PIN_LENGTH = 4;
constexpr char BT_PAIR_PIN[] = "1234";
constexpr uint8_t GAMEPAD_REPORT_ID = 1;

// ── Transport selection ─────────────────────────────────
#if defined(SWITCH_AUTO_DRAW_USE_CLASSIC_BT)
constexpr char CONTROL_TRANSPORT[] = "classic-bt";
constexpr bool USE_MOCK_CONTROLLER = false;
#else
constexpr char CONTROL_TRANSPORT[] = "mock";
constexpr bool USE_MOCK_CONTROLLER = true;
#endif
