#!/usr/bin/env python3
"""Suggest start/end trim for a screen recording so the loop never opens or ends on a frozen screen.
Usage: python3 scripts/find-trim.py <video> [hold-seconds=0.2]
Prints:  start  end  (source seconds)  -> pass to scripts/process-videos.sh"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from _motion import motion
import numpy as np
f = sys.argv[1]; hold = float(sys.argv[2]) if len(sys.argv) > 2 else 0.2
m = motion(f); T = len(m) / 30
act = np.where(m > 0.3)[0]
start = max(0.0, act[0] / 30 - hold); end = min(T, act[-1] / 30 + hold)
print(f"{start:.2f} {end:.2f}   (clip {T:.2f}s, first motion {act[0]/30:.2f}s, last motion {act[-1]/30:.2f}s)")
