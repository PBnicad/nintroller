#pragma once

#include <Arduino.h>
#include "config.h"
#include "controller_transport.h"
#include "seq_buffer.h"

bool parseCommand(const String &line, SeqCmd &cmd, String &error);

bool executeSeqCmd(const SeqCmd &cmd, ControllerTransport &transport, String &error);

const char *buttonName(ControllerButton button);
