#!/usr/bin/env bash
# Usage: scripts/process-videos.sh <input> <output-name> <width-px> [start-sec] [end-sec]
# One speed for every clip (SPEED, default 1.2x), no audio, H.264, faststart. FPS = SPEED x source fps (36 for 30 fps sources).
# NB: -t must come BEFORE -i (input option), otherwise it cuts the already sped-up output and the end trim is silently ignored.
# Trim the frozen lead-in / tail first:  python3 scripts/find-trim.py <input>   (prints start + end)
set -euo pipefail
in="$1"; name="$2"; w="${3:-750}"; ss="${4:-0}"; to="${5:-}"
out="$(dirname "$0")/../assets/video"
mkdir -p "$out"
dur=(); [ -n "$to" ] && dur=(-t "$(python3 -c "print(round($to-$ss,3))")")
ffmpeg -y -loglevel error -ss "$ss" "${dur[@]}" -i "$in" -an \
  -vf "setpts=PTS/${SPEED:-1.2},fps=${FPS:-36},scale=${w}:-2:flags=lanczos" \
  -c:v libx264 -preset slow -crf 23 -pix_fmt yuv420p -profile:v high -level 4.2 -g 90 \
  -movflags +faststart "$out/${name}.mp4"
ls -lh "$out/${name}.mp4"
