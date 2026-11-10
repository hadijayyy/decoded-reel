#!/usr/bin/env bash
# Downloads the official FC Barcelona crest, fonts and trophy icons from fcbarcelona.com into ./assets
# (not committed: these are the club's trademarks / licensed fonts — fetched at build time for personal/concept use).
set -euo pipefail
cd "$(dirname "$0")"; S=../../scripts
python3 $S/site_scan.py https://www.fcbarcelona.com/en/ assets/scan > /dev/null
mkdir -p assets/fonts
for f in FC_BARCELONACONDENSEDPRO-Bold FC_BARCELONA-Extrabold FC_BARCELONA-Semibold FC_BARCELONA-Regular; do cp assets/scan/raw/$f.woff2 assets/fonts/; done
python3 $S/svg_to_paths.py assets/scan/raw/icn.svg assets/logo_paths.json --symbol fc-barcelona
python3 $S/symbols_to_icons.py assets/scan/raw/icn.svg assets/icons.json la-liga copa-del-rey champions-league club-world-cup
echo "assets ready"
