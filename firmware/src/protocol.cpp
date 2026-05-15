#include "protocol.h"

namespace {

ControllerButton parseButton(const String &token, bool &ok) {
    ok = true;
    if (token == "A") return ControllerButton::A;
    if (token == "B") return ControllerButton::B;
    if (token == "X") return ControllerButton::X;
    if (token == "Y") return ControllerButton::Y;
    if (token == "L") return ControllerButton::L;
    if (token == "R") return ControllerButton::R;
    if (token == "ZL") return ControllerButton::ZL;
    if (token == "ZR") return ControllerButton::ZR;
    if (token == "+" || token == "PLUS") return ControllerButton::Plus;
    if (token == "-" || token == "MINUS") return ControllerButton::Minus;
    if (token == "HOME") return ControllerButton::Home;
    if (token == "CAPTURE" || token == "CAP") return ControllerButton::Capture;
    if (token == "LS" || token == "L3") return ControllerButton::LStick;
    if (token == "RS" || token == "R3") return ControllerButton::RStick;
    if (token == "DUP" || token == "UP") return ControllerButton::DpadUp;
    if (token == "DDOWN" || token == "DOWN") return ControllerButton::DpadDown;
    if (token == "DLEFT" || token == "LEFT") return ControllerButton::DpadLeft;
    if (token == "DRIGHT" || token == "RIGHT") return ControllerButton::DpadRight;
    ok = false;
    return ControllerButton::A;
}

bool parseInt(const String &value, int &result) {
    const int space = value.indexOf(' ');
    if (space < 0) return false;
    result = value.substring(space + 1).toInt();
    return true;
}

bool parseBtnCommand(const String &line, SeqCmd &cmd, String &error) {
    if (!line.startsWith("BTN ")) return false;
    const int s1 = line.indexOf(' ');
    const int s2 = line.indexOf(' ', s1 + 1);
    String name;
    if (s2 < 0) {
        name = line.substring(s1 + 1);
    } else {
        name = line.substring(s1 + 1, s2);
    }
    bool ok = false;
    const ControllerButton btn = parseButton(name, ok);
    if (!ok) {
        error = "unknown button: " + name;
        return false;
    }
    uint16_t dur = BUTTON_PRESS_DURATION_MS;
    if (s2 >= 0) {
        int parsed = line.substring(s2 + 1).toInt();
        if (parsed < 0 || parsed > 60000) {
            error = "invalid duration";
            return false;
        }
        dur = static_cast<uint16_t>(parsed);
    }
    cmd.type = SeqCmdType::BTN;
    cmd.buttonsMask = controllerButtonMask(btn);
    cmd.duration = dur;
    cmd.stickX = 0;
    cmd.stickY = 0;
    return true;
}

bool parseHoldCommand(const String &line, SeqCmd &cmd, String &error) {
    if (!line.startsWith("HOLD ")) return false;
    const int s1 = line.indexOf(' ');
    const int s2 = line.indexOf(' ', s1 + 1);
    if (s2 < 0) {
        error = "HOLD requires button and duration";
        return false;
    }
    const String name = line.substring(s1 + 1, s2);
    bool ok = false;
    const ControllerButton btn = parseButton(name, ok);
    if (!ok) {
        error = "unknown button: " + name;
        return false;
    }
    const int parsed = line.substring(s2 + 1).toInt();
    if (parsed <= 0 || parsed > 60000) {
        error = "invalid hold duration";
        return false;
    }
    cmd.type = SeqCmdType::BTN;
    cmd.buttonsMask = controllerButtonMask(btn);
    cmd.duration = static_cast<uint16_t>(parsed);
    cmd.stickX = 0;
    cmd.stickY = 0;
    return true;
}

bool parseStickCommand(const String &line, SeqCmd &cmd, String &error) {
    if (!line.startsWith("STICK ")) return false;
    const int s1 = line.indexOf(' ');
    const int s2 = line.indexOf(' ', s1 + 1);
    if (s2 < 0) {
        error = "STICK requires side, x, y";
        return false;
    }
    const String side = line.substring(s1 + 1, s2);
    if (side != "L" && side != "R") {
        error = "stick side must be L or R";
        return false;
    }
    const int s3 = line.indexOf(' ', s2 + 1);
    if (s3 < 0) {
        error = "STICK requires x and y";
        return false;
    }
    int x = line.substring(s2 + 1, s3).toInt();
    int s4 = line.indexOf(' ', s3 + 1);
    int y = 0;
    if (s4 < 0) {
        y = line.substring(s3 + 1).toInt();
    } else {
        y = line.substring(s3 + 1, s4).toInt();
    }
    if (x < -1 || x > 1 || y < -1 || y > 1 || (x == 0 && y == 0)) {
        error = "stick values must be -1, 0, or 1 (not both zero)";
        return false;
    }
    uint16_t dur = STICK_DURATION_MS;
    if (s4 >= 0) {
        int parsed = line.substring(s4 + 1).toInt();
        if (parsed < 0 || parsed > 60000) {
            error = "invalid stick duration";
            return false;
        }
        dur = static_cast<uint16_t>(parsed);
    }
    cmd.type = SeqCmdType::STICK;
    cmd.buttonsMask = 0;
    cmd.stickX = static_cast<int8_t>(x);
    cmd.stickY = static_cast<int8_t>(y);
    cmd.duration = dur;
    return true;
}

bool parseWaitCommand(const String &line, SeqCmd &cmd, String &error) {
    if (!line.startsWith("WAIT ")) return false;
    int ms = 0;
    if (!parseInt(line, ms)) {
        error = "WAIT requires duration in ms";
        return false;
    }
    if (ms <= 0 || ms > 60000) {
        error = "wait duration must be 1-60000";
        return false;
    }
    cmd.type = SeqCmdType::WAIT;
    cmd.buttonsMask = 0;
    cmd.stickX = 0;
    cmd.stickY = 0;
    cmd.duration = static_cast<uint16_t>(ms);
    return true;
}

bool parseComboCommand(const String &line, SeqCmd &cmd, String &error) {
    if (!line.startsWith("COMBO ")) return false;
    const int s1 = line.indexOf(' ');
    if (s1 < 0) {
        error = "COMBO requires buttons and duration";
        return false;
    }
    int s2 = line.indexOf(' ', s1 + 1);
    String btnStr;
    if (s2 < 0) {
        btnStr = line.substring(s1 + 1);
    } else {
        btnStr = line.substring(s1 + 1, s2);
    }
    if (btnStr.length() == 0) {
        error = "COMBO requires button names separated by +";
        return false;
    }

    uint32_t mask = 0;
    int start = 0;
    while (start < btnStr.length()) {
        int sep = btnStr.indexOf('+', start);
        if (sep < 0) sep = btnStr.length();
        String name = btnStr.substring(start, sep);
        name.trim();
        if (name.length() > 0) {
            bool ok = false;
            ControllerButton btn = parseButton(name, ok);
            if (!ok) {
                error = "unknown button in combo: " + name;
                return false;
            }
            mask |= controllerButtonMask(btn);
        }
        start = sep + 1;
    }
    if (mask == 0) {
        error = "no valid buttons in combo";
        return false;
    }

    uint16_t dur = BUTTON_PRESS_DURATION_MS;
    if (s2 >= 0) {
        int parsed = line.substring(s2 + 1).toInt();
        if (parsed < 0 || parsed > 60000) {
            error = "invalid duration";
            return false;
        }
        dur = static_cast<uint16_t>(parsed);
    }
    cmd.type = SeqCmdType::BTN;
    cmd.buttonsMask = mask;
    cmd.duration = dur;
    cmd.stickX = 0;
    cmd.stickY = 0;
    return true;
}

}  // namespace

bool parseCommand(const String &line, SeqCmd &cmd, String &error) {
    if (line.startsWith("BTN ")) return parseBtnCommand(line, cmd, error);
    if (line.startsWith("HOLD ")) return parseHoldCommand(line, cmd, error);
    if (line.startsWith("COMBO ")) return parseComboCommand(line, cmd, error);
    if (line.startsWith("STICK ")) return parseStickCommand(line, cmd, error);
    if (line.startsWith("WAIT ")) return parseWaitCommand(line, cmd, error);
    error = "unknown command";
    return false;
}

bool executeSeqCmd(const SeqCmd &cmd, ControllerTransport &transport, String &error) {
    switch (cmd.type) {
        case SeqCmdType::BTN:
            if (!transport.pressButtons(cmd.buttonsMask, cmd.duration, INPUT_DELAY_MS)) {
                error = "controller input report failed";
                return false;
            }
            return true;
        case SeqCmdType::STICK:
            if (!transport.moveDirection(cmd.stickX, cmd.stickY, cmd.duration, INPUT_DELAY_MS)) {
                error = "controller input report failed";
                return false;
            }
            return true;
        case SeqCmdType::WAIT:
            delay(cmd.duration);
            return true;
        default:
            error = "unknown command type";
            return false;
    }
}

const char *buttonName(ControllerButton button) {
    switch (button) {
        case ControllerButton::A: return "A";
        case ControllerButton::B: return "B";
        case ControllerButton::X: return "X";
        case ControllerButton::Y: return "Y";
        case ControllerButton::L: return "L";
        case ControllerButton::R: return "R";
        case ControllerButton::ZL: return "ZL";
        case ControllerButton::ZR: return "ZR";
        case ControllerButton::Plus: return "PLUS";
        case ControllerButton::Minus: return "MINUS";
        case ControllerButton::Home: return "HOME";
        case ControllerButton::Capture: return "CAPTURE";
        case ControllerButton::LStick: return "LS";
        case ControllerButton::RStick: return "RS";
        case ControllerButton::DpadUp: return "DUP";
        case ControllerButton::DpadDown: return "DDOWN";
        case ControllerButton::DpadLeft: return "DLEFT";
        case ControllerButton::DpadRight: return "DRIGHT";
        default: return "?";
    }
}
