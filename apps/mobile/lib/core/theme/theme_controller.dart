import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:next_bank/core/theme/theme_choice.dart';
import 'package:next_bank/core/theme/theme_store.dart';

/// Where the theme choice is kept; bound in main.dart.
final Provider<ThemeStore> themeStoreProvider = Provider(
  (ref) => throw UnimplementedError('Bound in main.dart'),
);

/// The theme the app shows (week 7 plan, D9).
final AsyncNotifierProvider<ThemeController, ThemeChoice> themeChoiceProvider =
    AsyncNotifierProvider(ThemeController.new);

/// Reads the kept choice on opening and keeps every new one.
class ThemeController extends AsyncNotifier<ThemeChoice> {
  // Writes run one after another, so the last choice is the one kept.
  Future<void> _writes = Future.value();

  @override
  Future<ThemeChoice> build() => ref.read(themeStoreProvider).read();

  /// Shows [choice] at once and keeps it; if the device refuses it, it holds
  /// until the app closes.
  Future<void> choose(ThemeChoice choice) {
    state = AsyncData(choice);
    final store = ref.read(themeStoreProvider);
    return _writes = _writes.then((_) async {
      try {
        await store.write(choice);
      } on PlatformException {
        // Only the look is lost on the next opening; nothing to tell.
      }
    });
  }
}
