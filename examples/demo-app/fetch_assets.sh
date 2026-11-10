#!/usr/bin/env bash
# Demo assets: open-source fonts from npm (@fontsource, SIL OFL) + the hand-drawn demo logo in this folder.
set -euo pipefail
cd "$(dirname "$0")"; S=../../scripts; mkdir -p assets/fonts assets/tmp
( cd assets/tmp && npm pack --silent @fontsource/anton @fontsource/inter >/dev/null && for f in *.tgz; do tar xzf "$f"; mv package "${f%.tgz}"; done )
cp assets/tmp/fontsource-anton-*/files/anton-latin-400-normal.woff2 assets/fonts/display.woff2
cp assets/tmp/fontsource-inter-*/files/inter-latin-800-normal.woff2 assets/fonts/heavy.woff2
cp assets/tmp/fontsource-inter-*/files/inter-latin-600-normal.woff2 assets/fonts/ui.woff2
cp assets/tmp/fontsource-inter-*/files/inter-latin-400-normal.woff2 assets/fonts/body.woff2
rm -rf assets/tmp
python3 $S/svg_to_paths.py logo.svg assets/logo_paths.json
echo "assets ready"
