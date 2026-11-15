#!/bin/sh
set -eu
# Compatibility entry point. Never produce a plaintext dump.
exec node "$(dirname "$0")/../scripts/backup.mjs" create "${1:?Supply a unique .edubest-backup destination}"
