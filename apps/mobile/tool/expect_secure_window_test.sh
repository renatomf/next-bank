#!/usr/bin/env sh
# Tests expect_secure_window.sh against the two ways Android prints a
# window's flags in dumpsys: one hex number (the S21) and names on one line
# (the CI emulator, which the first version misread). A fake adb on the PATH
# prints each fixture; no device is needed. Run from apps/mobile.
set -u

fake=$(mktemp -d)
trap 'rm -rf "$fake"' EXIT
cat > "$fake/adb" <<'EOF'
#!/usr/bin/env sh
case "$*" in
  *dumpsys*) printf '%b\n' "$FIXTURE" ;;
esac
EOF
chmod +x "$fake/adb"

app='  Window #3 Window{a1 u0 dev.renatomf.nextbank/dev.renatomf.nextbank.MainActivity}:\n    mAttrs={(0,0)(fillxfill) ty=BASE_APPLICATION fmt=TRANSLUCENT'
# Another app's secure window must not count for ours.
other='  Window #2 Window{b2 u0 com.example.other/Main}:\n      fl=SECURE'

failures=0
expect() { # name, fixture, wanted exit code
  FIXTURE="$2" PATH="$fake:$PATH" sh tool/expect_secure_window.sh >/dev/null 2>&1
  got=$?
  if [ "$got" -eq "$3" ]; then
    echo "ok   $1"
  else
    echo "FAIL $1: exit $got, wanted $3"
    failures=$((failures + 1))
  fi
}

expect 'hex with the bit' "$other\n$app\n      fl=81812100\n      pfl=100088c0" 0
expect 'hex without the bit' "$other\n$app\n      fl=81810100\n      pfl=100088c0" 1
expect 'names with SECURE' "$other\n$app\n      fl=LAYOUT_IN_SCREEN LAYOUT_INSET_DECOR SECURE\n      pfl=FORCE_DRAW_STATUS_BAR_BACKGROUND" 0
expect 'names without SECURE' "$other\n$app\n      fl=LAYOUT_IN_SCREEN LAYOUT_INSET_DECOR\n      pfl=FORCE_DRAW_STATUS_BAR_BACKGROUND" 1
expect 'no window of the app' "$other" 1

[ "$failures" -eq 0 ]
