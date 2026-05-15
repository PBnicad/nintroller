#include "seq_buffer.h"

void SeqBuffer::clear() {
    count_ = 0;
}

bool SeqBuffer::append(const SeqCmd &cmd) {
    if (isFull()) {
        return false;
    }
    buffer_[count_] = cmd;
    count_ += 1;
    return true;
}

const SeqCmd &SeqBuffer::get(uint16_t index) const {
    return buffer_[index];
}
