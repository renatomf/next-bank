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

# The app window's flags in dumpsys: the "fl=" value inside its "Window #"
# block ("pfl=" holds private flags, not these). Recent Android prints them
# as hex (fl=81812100), older as names (fl=... SECURE ...).
flags=$(adb shell dumpsys window windows | tr -d '\r' | awk -v pkg="$package" '
  /^  Window #/ { inside = index($0, pkg "/") > 0 }
  inside && match($0, /(^|[^p])fl=[^ ]+/) {
    print substr($0, RSTART, RLENGTH); exit
  }
' | sed 's/^.*fl=//')

if [ -z "$flags" ]; then
  echo "MOB-14: no window of $package found; did the app start?" >&2
  exit 1
fi

# FLAG_SECURE is bit 0x2000 of WindowManager.LayoutParams.flags.
case "$flags" in
  *SECURE*) secure=1 ;;
  *[!0-9a-fA-F]*) secure=0 ;;
  *) secure=$(( (0x$flags & 0x2000) != 0 )) ;;
esac

if [ "$secure" -ne 1 ]; then
  echo "MOB-14: the release window lacks FLAG_SECURE (fl=$flags);" >&2
  echo "screenshots and recordings would show the customer's data." >&2
  exit 1
fi
echo "MOB-14: the release window is secure (fl=$flags)."
