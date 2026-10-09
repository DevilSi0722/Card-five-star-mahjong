#!/usr/bin/python3
import ctypes
import os
import signal
import sys

parent = os.getppid()
if ctypes.CDLL(None, use_errno=True).prctl(1, signal.SIGTERM, 0, 0, 0) != 0:
    raise OSError(ctypes.get_errno(), "Cannot set parent death signal")
if parent == 1 or os.getppid() != parent:
    raise SystemExit("Supervisor exited")
os.execv(sys.argv[1], sys.argv[1:])
