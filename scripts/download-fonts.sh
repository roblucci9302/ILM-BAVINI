#!/bin/bash
# Download Inter font files for local hosting
# Run this script from the project root: ./scripts/download-fonts.sh

set -e

FONTS_DIR="public/fonts"
INTER_VERSION="4.0"
BASE_URL="https://github.com/rsms/inter/raw/v${INTER_VERSION}/docs/font-files"

echo "Creating fonts directory..."
mkdir -p "$FONTS_DIR"

echo "Downloading Inter font files..."

# Download each weight
curl -L -o "$FONTS_DIR/Inter-Regular.woff2" \
  "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hjp-Ek-_EeA.woff2"

curl -L -o "$FONTS_DIR/Inter-Medium.woff2" \
  "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuI6fAZ9hjp-Ek-_EeA.woff2"

curl -L -o "$FONTS_DIR/Inter-SemiBold.woff2" \
  "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuGKYAZ9hjp-Ek-_EeA.woff2"

curl -L -o "$FONTS_DIR/Inter-Bold.woff2" \
  "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuFuYAZ9hjp-Ek-_EeA.woff2"

echo "Font files downloaded successfully!"
echo ""
echo "Files created:"
ls -la "$FONTS_DIR"/*.woff2
