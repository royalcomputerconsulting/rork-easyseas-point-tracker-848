#!/bin/bash
cd "$(dirname "$0")/src"
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python main.py
read -n 1 -s -r -p "Press any key to close..."
