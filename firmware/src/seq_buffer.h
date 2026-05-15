#pragma once

#include <Arduino.h>
#include "config.h"

enum class SeqCmdType : uint8_t {
    NONE = 0,
    BTN,
    STICK,
    WAIT,
};

struct SeqCmd {
    SeqCmdType type = SeqCmdType::NONE;
    uint32_t buttonsMask = 0;
    int8_t stickX = 0;
    int8_t stickY = 0;
    uint16_t duration = 0;
};

class SeqBuffer {
public:
    void clear();
    bool append(const SeqCmd &cmd);
    uint16_t size() const { return count_; }
    bool isEmpty() const { return count_ == 0; }
    bool isFull() const { return count_ >= SEQ_CAPACITY; }
    const SeqCmd &get(uint16_t index) const;

private:
    SeqCmd buffer_[SEQ_CAPACITY];
    uint16_t count_ = 0;
};
