import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/core/theme/theme_choice.dart';
import 'package:next_bank/core/theme/theme_controller.dart';

import '../../support/fake_theme_store.dart';

ProviderContainer setUpTheme(FakeThemeStore store) {
  final container = ProviderContainer(
    overrides: [themeStoreProvider.overrideWithValue(store)],
  );
  addTearDown(container.dispose);
  container.listen(themeChoiceProvider, (_, _) {});
  return container;
}

// The theme picker (week 7 plan, D9).
void main() {
  group('ThemeController', () {
    test('opens with the choice kept on the device', () async {
      final container = setUpTheme(FakeThemeStore(ThemeChoice.dark));

      expect(
        await container.read(themeChoiceProvider.future),
        ThemeChoice.dark,
      );
    });

    test('changes the theme at once and keeps the choice', () async {
      final store = FakeThemeStore();
      final container = setUpTheme(store);
      await container.read(themeChoiceProvider.future);

      final saving = container
          .read(themeChoiceProvider.notifier)
          .choose(ThemeChoice.light);

      expect(container.read(themeChoiceProvider).value, ThemeChoice.light);
      await saving;
      expect(store.stored, ThemeChoice.light);
    });

    test('keeps the last of two quick choices, on screen and stored', () async {
      final store = FakeThemeStore();
      final container = setUpTheme(store);
      await container.read(themeChoiceProvider.future);
      final controller = container.read(themeChoiceProvider.notifier);

      await Future.wait([
        controller.choose(ThemeChoice.light),
        controller.choose(ThemeChoice.dark),
      ]);

      expect(container.read(themeChoiceProvider).value, ThemeChoice.dark);
      expect(store.writes, [ThemeChoice.light, ThemeChoice.dark]);
      expect(store.stored, ThemeChoice.dark);
    });

    test('keeps the choice for now when the device refuses it', () async {
      final store = FakeThemeStore()..failWrites = true;
      final container = setUpTheme(store);
      await container.read(themeChoiceProvider.future);

      await container
          .read(themeChoiceProvider.notifier)
          .choose(ThemeChoice.dark);

      expect(container.read(themeChoiceProvider).value, ThemeChoice.dark);
      expect(store.stored, ThemeChoice.system);
    });
  });
}
