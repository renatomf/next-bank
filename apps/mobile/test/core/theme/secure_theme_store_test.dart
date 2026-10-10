import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/core/theme/secure_theme_store.dart';
import 'package:next_bank/core/theme/theme_choice.dart';

// The theme chosen on the Profile (week 7 plan, D9): kept in the secure
// storage, since the app has no plain preferences (MOB-01).
void main() {
  setUp(() => FlutterSecureStorage.setMockInitialValues({}));

  test('each choice has its theme mode', () {
    expect(ThemeChoice.system.mode, ThemeMode.system);
    expect(ThemeChoice.light.mode, ThemeMode.light);
    expect(ThemeChoice.dark.mode, ThemeMode.dark);
  });

  group('SecureThemeStore', () {
    test('follows the system when nothing was chosen', () async {
      expect(await SecureThemeStore().read(), ThemeChoice.system);
    });

    test('reads back what it wrote', () async {
      final store = SecureThemeStore();

      await store.write(ThemeChoice.light);

      expect(await store.read(), ThemeChoice.light);
    });

    test('keeps only a choice other than the system', () async {
      final store = SecureThemeStore();
      await store.write(ThemeChoice.dark);

      await store.write(ThemeChoice.system);

      expect(
        await SecureThemeStore.storage.read(key: SecureThemeStore.key),
        isNull,
      );
      expect(await store.read(), ThemeChoice.system);
    });

    test('follows the system when the stored value is unknown', () async {
      FlutterSecureStorage.setMockInitialValues({
        SecureThemeStore.key: 'sepia',
      });

      expect(await SecureThemeStore().read(), ThemeChoice.system);
    });
  });
}
