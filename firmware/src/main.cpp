#include <Arduino.h>

#include "config.h"
#include "classic_bt_controller_transport.h"
#include "mock_controller_transport.h"
#include "protocol.h"
#include "seq_buffer.h"

#if USE_MOCK_CONTROLLER
MockControllerTransport mockTransport;
ControllerTransport &transport = mockTransport;
#else
ClassicBtControllerTransport classicBtTransport;
ControllerTransport &transport = classicBtTransport;
#endif

enum class OpMode : uint8_t {
    IMMEDIATE,
    SEQUENCE,
};

namespace {
OpMode currentMode = OpMode::IMMEDIATE;
SeqBuffer seqBuffer;
}  // namespace

void handleImmediateCommand(const String &line) {
    SeqCmd cmd;
    String error;
    if (!parseCommand(line, cmd, error)) {
        Serial.println("ERR " + error);
        return;
    }
    if (!executeSeqCmd(cmd, transport, error)) {
        Serial.println("ERR " + error);
        return;
    }
    Serial.println("OK");
}

void handleSequenceBufferCommand(const String &line) {
    SeqCmd cmd;
    String error;
    if (!parseCommand(line, cmd, error)) {
        Serial.println("ERR " + error);
        return;
    }
    if (!seqBuffer.append(cmd)) {
        Serial.println("ERR sequence buffer full");
        return;
    }
    Serial.printf("QUEUED %u\n", seqBuffer.size());
}

void handleSequencePlay() {
    if (seqBuffer.isEmpty()) {
        Serial.println("OK");
        return;
    }
    for (uint16_t i = 0; i < seqBuffer.size(); i += 1) {
        const SeqCmd &cmd = seqBuffer.get(i);
        String error;
        if (!executeSeqCmd(cmd, transport, error)) {
            Serial.printf("ERR %s at step %u\n", error.c_str(), i + 1);
            return;
        }
        Serial.printf("DONE %u\n", i + 1);
    }
    Serial.println("SEQ COMPLETE");
}

void printInfo() {
    Serial.printf("INFO firmware=%s version=%s\n", FIRMWARE_NAME, FIRMWARE_VERSION);
    Serial.printf("INFO board=%s mode=%s seq=%u/%u\n", BOARD_FAMILY,
                  currentMode == OpMode::IMMEDIATE ? "immediate" : "sequence",
                  seqBuffer.size(), SEQ_CAPACITY);
    transport.printStatus(Serial);
}

void setup() {
    Serial.begin(SERIAL_BAUD_RATE);
    transport.begin();
    Serial.printf("BOOT %s version=%s board=%s transport=%s mock=%s\n", FIRMWARE_NAME,
                  FIRMWARE_VERSION, BOARD_FAMILY, transport.name(),
                  USE_MOCK_CONTROLLER ? "true" : "false");
}

void loop() {
    if (!Serial.available()) {
        delay(2);
        return;
    }

    String line = Serial.readStringUntil('\n');
    line.trim();
    if (line.length() == 0) return;

    if (line == "MODE IMMEDIATE") {
        currentMode = OpMode::IMMEDIATE;
        seqBuffer.clear();
        Serial.println("OK");
        return;
    }
    if (line == "MODE SEQUENCE") {
        currentMode = OpMode::SEQUENCE;
        seqBuffer.clear();
        Serial.println("OK");
        return;
    }
    if (line == "INFO") {
        printInfo();
        return;
    }
    if (line == "RESET") {
        if (!transport.resetConnection(false)) {
            Serial.println("ERR bt reset failed");
            return;
        }
        Serial.println("OK");
        return;
    }
    if (line == "PAIR") {
        if (!transport.clearStoredPeer()) {
            Serial.println("ERR bt clear peer failed");
            return;
        }
        if (!transport.resetConnection(false)) {
            Serial.println("ERR bt pair reset failed");
            return;
        }
        uint32_t started = millis();
        while (!transport.isDiscoverable()) {
            if (millis() - started > 10000) {
                Serial.println("ERR bt pair timeout - not discoverable");
                return;
            }
            delay(50);
        }
        Serial.printf("OK pairing mode entered — put Switch in Change Grip/Order screen\n");
        return;
    }

    if (currentMode == OpMode::SEQUENCE) {
        if (line == "SEQ BEGIN") {
            seqBuffer.clear();
            Serial.println("OK");
            return;
        }
        if (line == "SEQ PLAY") {
            handleSequencePlay();
            return;
        }
        if (line == "SEQ CLEAR") {
            seqBuffer.clear();
            Serial.println("OK");
            return;
        }
        handleSequenceBufferCommand(line);
    } else {
        handleImmediateCommand(line);
    }
}
