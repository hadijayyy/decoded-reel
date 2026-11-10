#!/usr/bin/env bash
# mux.sh <project> <out.mp4>  — concat bar segments + score.wav, loudness-normalise, verify
set -euo pipefail
PROJ=$(cd "$1" && pwd); OUT=$2; B="$PROJ/build"
ls "$B"/seg/s*.mp4 | grep -v part | sort | sed "s/^/file '/;s/$/'/" > "$B/list.txt"
ffmpeg -y -hide_banner -loglevel error -f concat -safe 0 -i "$B/list.txt" -c copy "$B/video.mp4"
ffmpeg -y -hide_banner -loglevel error -i "$B/video.mp4" -i "$B/score.wav" -map 0:v -map 1:a -c:v copy \
  -af loudnorm=I=-15:TP=-2 -ar 48000 -c:a aac -b:a 256k -shortest -movflags +faststart "$OUT"
ffprobe -v error -show_entries stream=codec_name,nb_frames,duration,width,height,r_frame_rate -of compact "$OUT"
