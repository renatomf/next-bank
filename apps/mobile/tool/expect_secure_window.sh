#!/usr/bin/env sh
# MOB-14 (v1.1.0 plan, task 7): a release build's window carries FLAG_SECURE,
# so Android blocks screenshots, blacks out recordings and hides the app's
# recents thumbnail. Installs the release APK on the connected device or
# emulator (ANDROID_SERIAL picks one), opens it and reads the window's flags.
# Run from apps/mobile after `flutter build apk --release`.
set -eu

package=dev.renatomf.nextbank
apk=build/app/outputs/flutter-apk/app-release.apk

adb install -r "$apk" >/dev/null
adb shell am start -W -n "$package/.MainActivity" >/dev/null
# The first frame takes a moment on an emulator.
sleep 5

# The app window's flags in dumpsys: the rest of the "fl=" line inside its
# "Window #" block ("pfl=" holds private flags, not these). Some Android
# builds print them as one hex number (fl=81812100 on the S21), others as
# names on one line (fl=LAYOUT_IN_SCREEN ... SECURE on the CI emulator).
flags=$(adb shell dumpsys window windows | tr -d '\r' | awk -v pkg="$package" '
  /^  Window #/ { inside = index($0, pkg "/") > 0 }
  inside && match($0, /(^|[^p])fl=/) {
    print substr($0, RSTART + RLENGTH); exit
  }
')

if [ -z "$flags" ]; then
  echo "MOB-14: no window of $package found; did the app start?" >&2
  exit 1
fi

# By name, SECURE as a whole word; as hex, FLAG_SECURE is bit 0x2000 of
# WindowManager.LayoutParams.flags.
first=${flags%% *}
if printf ' %s ' "$flags" | grep -q ' SECURE '; then
  secure=1
elif printf '%s' "$first" | grep -qE '^[0-9a-fA-F]+$'; then
  secure=$(( (0x$first & 0x2000) != 0 ))
else
  secure=0
fi

if [ "$secure" -ne 1 ]; then
  echo "MOB-14: the release window lacks FLAG_SECURE (fl=$flags);" >&2
  echo "screenshots and recordings would show the customer's data." >&2
  exit 1
fi
echo "MOB-14: the release window is secure (fl=$flags)."
