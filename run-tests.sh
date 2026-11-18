#!/bin/sh
# Builds, then runs the unit tests and browser smoke tests (needs: node, python3 + playwright, Google Chrome).
# smoke4 needs a real manual: SAMPLE_MANUAL=/path/to/manual.pdf ./run-tests.sh   (skipped if unset)
set -e
cd "$(dirname "$0")"
python3 build.py
cd test
node t1.js
for s in smoke smoke2 smoke5 smoke6 smoke7 smoke8 smoke9 smoke10 smoke11 smoke12 smoke13 smoke14; do echo "== $s"; python3 $s.py | tail -3; done
[ -n "$SAMPLE_MANUAL" ] && { echo "== smoke4"; python3 smoke4.py | tail -3; } || true
