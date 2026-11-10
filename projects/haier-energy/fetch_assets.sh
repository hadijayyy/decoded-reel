#!/usr/bin/env bash
# Haier Energy assets: the official wordmark PNG (fetched from the site, NOT committed) traced to vector,
# plus open-source fonts (Barlow Condensed + Inter, SIL OFL) from npm. Needs: pip install potracer numpy scipy pillow
set -euo pipefail
cd "$(dirname "$0")"; S=../../scripts; mkdir -p assets/raw assets/fonts assets/tmp
curl -sSfL -o assets/raw/logo.png https://www.haier-energy.com/static/logo-d7d1215e.png
python3 $S/png_to_paths.py assets/raw/logo.png assets/wordmark_paths.json --fill '#ffffff'
python3 $S/add_plate.py assets/wordmark_paths.json assets/logo_paths.json --padx 180 --pady 170 --radius 100 --ring 12 --outline '#15569e' --inner '#0d173a'
( cd assets/tmp && npm pack --silent @fontsource/barlow-condensed @fontsource/inter >/dev/null && for f in *.tgz; do tar xzf "$f"; mv package "${f%.tgz}"; done )
cp assets/tmp/fontsource-barlow-condensed-*/files/barlow-condensed-latin-700-normal.woff2 assets/fonts/display.woff2
cp assets/tmp/fontsource-barlow-condensed-*/files/barlow-condensed-latin-800-normal.woff2 assets/fonts/heavy.woff2
cp assets/tmp/fontsource-inter-*/files/inter-latin-600-normal.woff2 assets/fonts/ui.woff2
cp assets/tmp/fontsource-inter-*/files/inter-latin-400-normal.woff2 assets/fonts/body.woff2
rm -rf assets/tmp
echo "assets ready"
