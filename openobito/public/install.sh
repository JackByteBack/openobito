#!/bin/bash
set -e
OS=$(uname -s)
ARCH=$(uname -m)
VERSION=$(curl -s https://api.github.com/repos/openagent-dev/openagent/releases/latest | grep tag_name | cut -d'"' -f4)

case "$OS" in
  Linux)  BINARY="openagent-linux" ;;
  Darwin) BINARY="openagent-macos" ;;
  *)      echo "Windows: npm install -g openagent"; exit 0 ;;
esac

URL="https://github.com/openagent-dev/openagent/releases/download/$VERSION/$BINARY"
curl -fsSL "$URL" -o /usr/local/bin/openagent
chmod +x /usr/local/bin/openagent
echo "OpenAgent $VERSION installed!"
