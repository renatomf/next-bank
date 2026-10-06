import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

// MOB-01 on Android: app data, including the encrypted token record, must not
// leave the device through cloud backup or device-to-device transfer.
void main() {
  final manifest = File('android/app/src/main/AndroidManifest.xml')
      .readAsStringSync();

  test('disables backup of the app data', () {
    expect(manifest, contains('android:allowBackup="false"'));
  });

  test('excludes every data domain from cloud backup and device transfer', () {
    expect(
      manifest,
      contains('android:dataExtractionRules="@xml/data_extraction_rules"'),
    );
    final rules = File('android/app/src/main/res/xml/data_extraction_rules.xml')
        .readAsStringSync();

    for (final section in ['cloud-backup', 'device-transfer']) {
      final body = RegExp('<$section>([\\s\\S]*?)</$section>')
          .firstMatch(rules)?[1];
      expect(body, isNotNull, reason: '$section missing');
      for (final domain in ['root', 'file', 'database', 'sharedpref']) {
        expect(body, contains('domain="$domain"'), reason: '$section/$domain');
      }
    }
  });
}
