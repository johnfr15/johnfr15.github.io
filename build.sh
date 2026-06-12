#!/usr/bin/env bash
# Build every projects/*/slides.md into slides.pdf with Marp.
set -euo pipefail
cd "$(dirname "$0")"

shopt -s nullglob
decks=(projects/*/slides.md)

if [ ${#decks[@]} -eq 0 ]; then
  echo "no projects/*/slides.md found"
  exit 0
fi

for md in "${decks[@]}"; do
  echo "── marp: $md"
  npx --yes @marp-team/marp-cli@latest "$md" \
    --pdf \
    --allow-local-files \
    --theme-set assets/marp-theme.css \
    -o "${md%.md}.pdf"
done

echo "done — ${#decks[@]} deck(s) built"
