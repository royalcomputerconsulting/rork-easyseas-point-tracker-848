
#!/usr/bin/env bash
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

PY_BIN=$(which python3.11 || which python3 || true)
if [ -z "$PY_BIN" ]; then
  echo "❌ Python 3 not found."
  exit 1
fi

if [ ! -d ".venv" ]; then
  echo "🔧 Creating virtual environment..."
  "$PY_BIN" -m venv .venv
fi

source .venv/bin/activate
pip install --upgrade pip setuptools wheel
pip install -r requirements.txt
python -m playwright install chromium || true

python src/main.py | tee logs/scraper.log

read -n 1 -s -r -p "Press any key to close..."
