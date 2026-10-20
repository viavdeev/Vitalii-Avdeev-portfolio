#!/usr/bin/env bash
# Usage: scripts/process-videos.sh <input-video> <output-name> <width-px>
# Speeds the clip up 1.5x, strips audio, encodes web-friendly H.264 (+ poster frame).
# Example: scripts/process-videos.sh ~/Desktop/goinvest-flow.mov gi-06 375
set -euo pipefail
in="$1"; name="$2"; w="${3:-750}"
out="$(dirname "$0")/../assets/video"
mkdir -p "$out"
ffmpeg -y -i "$in" -an \
  -vf "setpts=PTS/1.5,scale=${w}:-2:flags=lanczos,fps=30" \
  -c:v libx264 -preset slow -crf 22 -pix_fmt yuv420p -profile:v high -movflags +faststart \
  "$out/${name}.mp4"
ffmpeg -y -i "$out/${name}.mp4" -frames:v 1 -q:v 2 "$out/${name}-poster.jpg"
ls -lh "$out/${name}.mp4"
