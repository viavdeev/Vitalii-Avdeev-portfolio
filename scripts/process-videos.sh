#!/usr/bin/env bash
# Usage: scripts/process-videos.sh <input> <output-name> <width-px> [start-sec] [end-sec]
# 2x speed, no audio, H.264, all frames kept at up to 60 fps (smooth, no dropped frames),
# optional trim of the frozen lead-in / tail so the loop never "stalls" at the start.
set -euo pipefail
in="$1"; name="$2"; w="${3:-750}"; ss="${4:-0}"; to="${5:-}"
out="$(dirname "$0")/../assets/video"
mkdir -p "$out"
dur=(); [ -n "$to" ] && dur=(-t "$(python3 -c "print(round($to-$ss,3))")")
ffmpeg -y -ss "$ss" -i "$in" "${dur[@]}" -an \
  -vf "setpts=PTS/2,fps=60,scale=${w}:-2:flags=lanczos" \
  -c:v libx264 -preset slow -crf 23 -pix_fmt yuv420p -profile:v high -level 4.2 -g 120 \
  -movflags +faststart "$out/${name}.mp4"
ls -lh "$out/${name}.mp4"
