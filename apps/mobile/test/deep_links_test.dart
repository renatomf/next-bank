import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

// MASVS-PLATFORM: no deep links in V1. Flutter turns them on by default, and
// with a router any external link or intent could open a route directly.
void main() {
  test('Android does not route deep links into the app', () {
    final manifest = File('android/app/src/main/AndroidManifest.xml')
        .readAsStringSync();

    expect(
      manifest,
      matches(
        RegExp(
          r'android:name="flutter_deeplinking_enabled"\s+'
          'android:value="false"',
        ),
      ),
    );
  });

  test('iOS does not route deep links into the app', () {
    final plist = File('ios/Runner/Info.plist').readAsStringSync();

    expect(
      plist,
      matches(RegExp(r'<key>FlutterDeepLinkingEnabled</key>\s*<false/>')),
    );
  });
}
