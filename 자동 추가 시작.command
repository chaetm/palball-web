#!/bin/zsh
cd -- "${0:A:h}/palball-site" || exit 1
/usr/bin/python3 -B tools/sync_works.py --watch
