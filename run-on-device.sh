#!/usr/bin/env bash
# ============================================================================
# TallyKhata clone - build, install and launch on the connected device.
#
#   bash run-on-device.sh                 # build + install + launch
#   bash run-on-device.sh --wait          # poll up to 120s for the phone
#   bash run-on-device.sh --wait=300      # poll up to 300s
#   bash run-on-device.sh --with-server   # start the API first if it is down
#   bash run-on-device.sh --skip-build    # reuse the existing APK
#
# Wireless (use when USB will not enumerate - Android 11+):
#   bash run-on-device.sh --pair 192.168.1.7:37123 123456
#   bash run-on-device.sh --connect 192.168.1.7:5555
#
# The app talks to http://127.0.0.1:4000/api, tunnelled to this machine with
# `adb reverse`. That works over USB with no IP configuration, no LAN, no
# firewall rule. The tunnel must be re-established after every replug.
#
# The backend is the Next.js app in web/ (see README.md). --with-server starts
# that one: `next start` when a production build exists, `next dev` otherwise.
# The original Express server in backend/ is kept only as a reference; set
# API_DIR=backend to fall back to it.
# ============================================================================
set -u

ROOT="$(cd "$(dirname "$0")" && pwd)"
APK="$ROOT/app/build/outputs/apk/debug/app-debug.apk"
PKG="com.workbuddy.tallyclone"
PORT=4000
WAIT_SECS=0
WITH_SERVER=0
SKIP_BUILD="${SKIP_BUILD:-0}"
PAIR_TARGET=""
PAIR_CODE=""
CONNECT_TARGET=""
NODE="${NODE:-C:/Users/Admin/.workbuddy-ai/binaries/node/versions/22.22.2-2/node.exe}"

while [ $# -gt 0 ]; do
  case "$1" in
    --wait)         WAIT_SECS=120; shift ;;
    --wait=*)       WAIT_SECS="${1#*=}"; shift ;;
    --with-server)  WITH_SERVER=1; shift ;;
    --skip-build)   SKIP_BUILD=1; shift ;;
    --pair)         PAIR_TARGET="${2:-}"; PAIR_CODE="${3:-}"; shift 3 ;;
    --pair=*)       PAIR_TARGET="${1#*=}"; PAIR_CODE="${2:-}"; shift 2 ;;
    --connect)      CONNECT_TARGET="${2:-}"; shift 2 ;;
    --connect=*)    CONNECT_TARGET="${1#*=}"; shift ;;
    -h|--help)      awk 'NR<2{next} /^# =====/{c++; if(c==2){print; exit}} {print}' "$0"; exit 0 ;;
    *) echo "unknown option: $1"; exit 2 ;;
  esac
done

# --- locate adb ------------------------------------------------------------
# adb has been replaced/repaired a few times on this machine, so probe a few
# known-good locations rather than trusting a single hard-coded path.
find_adb() {
  local candidates=(
    "${LOCALAPPDATA:-}/Android/Sdk/platform-tools/adb.exe"
    "C:/Users/Admin/.workbuddy-ai/tools/pt/adb.exe"
    "$HOME/AppData/Local/Android/Sdk/platform-tools/adb.exe"
  )
  local c
  for c in "${candidates[@]}"; do
    [ -n "$c" ] && [ -x "$c" ] && { printf '%s' "$c"; return 0; }
  done
  if command -v adb >/dev/null 2>&1; then command -v adb; return 0; fi
  return 1
}

ADB="$(find_adb)" || {
  echo "ERROR: could not find adb.exe."
  echo "       Install platform-tools, or set ADB=/path/to/adb.exe and re-run."
  exit 1
}
echo "adb: $ADB"

# A corrupted adb binary segfaults (Windows 0xC0000005) and prints nothing.
# `version` is the cheapest probe for that.
if ! "$ADB" version >/dev/null 2>&1; then
  echo "ERROR: '$ADB version' failed - the adb binary looks broken."
  echo "       Re-download platform-tools and replace adb.exe + AdbWinApi.dll"
  echo "       + AdbWinUsbApi.dll together, from the same archive."
  exit 1
fi

# --- 0. wireless (optional) ------------------------------------------------
# Android 11+ "Wireless debugging" does not need a USB cable at all. Pair once
# with the 6-digit code shown on the phone, then connect.
if [ -n "$PAIR_TARGET" ]; then
  echo
  echo "== 0. pair $PAIR_TARGET =="
  if [ -z "$PAIR_CODE" ]; then
    echo "   ERROR: --pair needs the 6-digit code:  --pair <ip:port> <code>"
    echo "   Find both on the phone: Developer options > Wireless debugging >"
    echo "   'Pair device with pairing code'."
    exit 2
  fi
  "$ADB" pair "$PAIR_TARGET" "$PAIR_CODE" || {
    echo "   pairing failed. The pairing port is DIFFERENT from the connect port -"
    echo "   use the ip:port shown in the 'Pair device with pairing code' dialog."
    exit 1
  }
fi

if [ -n "$CONNECT_TARGET" ]; then
  echo
  echo "== 0. connect $CONNECT_TARGET =="
  "$ADB" connect "$CONNECT_TARGET" || true
fi

# --- 1. device -------------------------------------------------------------
echo
echo "== 1. device =="
device_online() { "$ADB" devices | grep -qE "[[:space:]]device$"; }

if ! device_online; then
  if [ "$WAIT_SECS" -gt 0 ]; then
    echo "   No device yet. Plug the phone in and accept 'Allow USB debugging?'."
    echo "   Waiting up to ${WAIT_SECS}s ..."
    waited=0
    while [ "$waited" -lt "$WAIT_SECS" ]; do
      sleep 3; waited=$((waited + 3))
      printf '\r   %ss ... ' "$waited"
      if device_online; then printf '\r'; echo "   device appeared after ${waited}s"; break; fi
    done
    printf '\r'
  fi
fi

if ! device_online; then
  echo "   No device attached. Plug the phone in, enable USB debugging,"
  echo "   accept the 'Allow USB debugging?' prompt, then re-run."
  echo "   Tip: 'bash run-on-device.sh --wait' keeps polling for you."
  echo
  echo "   If USB will not enumerate at all, use wireless debugging instead"
  echo "   (Android 11+): on the phone open Developer options > Wireless"
  echo "   debugging > 'Pair device with pairing code', then run:"
  echo "     bash run-on-device.sh --pair <ip:pairport> <6-digit-code> \\"
  echo "          --connect <ip:port> --wait --with-server"
  "$ADB" devices -l | tail -n +2
  exit 1
fi
"$ADB" devices -l | tail -n +2

# --- 2. reverse tunnel -----------------------------------------------------
echo
echo "== 2. reverse tunnel (device 127.0.0.1:$PORT -> host $PORT) =="
"$ADB" reverse --remove-all >/dev/null 2>&1
"$ADB" reverse "tcp:$PORT" "tcp:$PORT" && echo "   ok"
"$ADB" reverse --list

# --- 3. API health ---------------------------------------------------------
echo
echo "== 3. is the API up? =="
api_healthy() { curl -s --max-time 5 "http://127.0.0.1:$PORT/api/health" 2>/dev/null | grep -q '"ok":true'; }

# The backend is the Next.js app in web/. It supersedes the original Express
# server in backend/, which is kept only as a reference implementation.
#   API_DIR=web      (default) start Next.js
#   API_DIR=backend            start the legacy Express server
API_DIR="${API_DIR:-web}"
API_LOG="$ROOT/web/api.log"

start_api() {
  if [ "$API_DIR" = "backend" ]; then
    echo "   starting the legacy Express API (backend/) ..."
    ( cd "$ROOT/backend" && "$NODE" src/index.js >"$ROOT/backend/api.log" 2>&1 & )
    return
  fi
  if [ ! -d "$ROOT/web/node_modules/next" ]; then
    echo "   ERROR: web/node_modules is missing - run 'cd web && npm install' first."
    return 1
  fi
  if [ -f "$ROOT/web/.next/BUILD_ID" ]; then
    echo "   starting the Next.js API (web/, production build) ..."
    ( cd "$ROOT/web" && "$NODE" node_modules/next/dist/bin/next start -p "$PORT" >"$API_LOG" 2>&1 & )
  else
    echo "   starting the Next.js API (web/, dev - no production build found) ..."
    ( cd "$ROOT/web" && "$NODE" node_modules/next/dist/bin/next dev -p "$PORT" >"$API_LOG" 2>&1 & )
  fi
}

if [ "$WITH_SERVER" = "1" ] && ! api_healthy; then
  echo "   not running - starting it in the background ..."
  start_api
  # The first request after a cold start can take ~5s while the driver's SRV
  # lookup fails over to public resolvers, so allow generous headroom.
  for _ in $(seq 1 30); do sleep 1; api_healthy && break; done
  api_healthy || { echo "   see $API_LOG"; }
fi

if api_healthy; then
  echo "   api healthy"
else
  echo "   WARNING: no healthy API on port $PORT."
  echo "   Start it with:  cd web && npm run dev      (Next.js - the real backend)"
  echo "   or re-run with: bash run-on-device.sh --with-server"
fi

# --- 4. build --------------------------------------------------------------
echo
echo "== 4. build =="
if [ "$SKIP_BUILD" != "1" ]; then
  export JAVA_HOME='C:\Program Files\Microsoft\jdk-17.0.20.101-hotspot'
  GRADLE="$ROOT/../.workbuddy-ai/tools/gradle-8.7/bin/gradle.bat"
  [ -x "$GRADLE" ] || GRADLE="$ROOT/gradlew"
  (cd "$ROOT" && "$GRADLE" assembleDebug -q) || { echo "   build failed"; exit 1; }
  echo "   built $(ls -l "$APK" | awk '{print $5}') bytes"
else
  echo "   skipped (--skip-build)"
fi

[ -f "$APK" ] || { echo "ERROR: no APK at $APK"; exit 1; }

# --- 5. install ------------------------------------------------------------
echo
echo "== 5. install =="
APK_WIN="$(cygpath -w "$APK" 2>/dev/null || printf '%s' "$APK")"
"$ADB" install -r "$APK_WIN" | tail -1

# --- 6. launch -------------------------------------------------------------
echo
echo "== 6. launch =="
"$ADB" shell am force-stop "$PKG"
"$ADB" shell am start -n "$PKG/.MainActivity" >/dev/null
sleep 6
"$ADB" shell dumpsys window 2>/dev/null | grep -m1 mCurrentFocus

echo
echo "Done. The app opens on the লগইন screen - sign in with a phone number:"
echo "   01706617723 / 123456    (fahim - 6 customers)"
echo "   01811223344 / 123456    (করিম  - 2 customers)"
echo "Or tap রেজিস্টার করুন to open a fresh account with its own empty book."
echo
echo "If the app shows a red banner, the API is not reachable -"
echo "check the server log and re-run step 2 (replugging drops the tunnel)."
echo
echo "Screenshot the current screen with:"
echo "  \"$ADB\" exec-out screencap -p > shot.png"
