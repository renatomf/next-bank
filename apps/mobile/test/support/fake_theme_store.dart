import 'package:flutter/services.dart';
import 'package:next_bank/core/theme/theme_choice.dart';
import 'package:next_bank/core/theme/theme_store.dart';

/// The theme choice in memory; [failWrites] makes the device refuse it.
class FakeThemeStore implements ThemeStore {
  new([this.stored = ThemeChoice.system]);

  /// What the device holds.
  ThemeChoice stored;

  /// Whether the next writes fail.
  bool failWrites = false;

  /// Choices written, in order.
  final List<ThemeChoice> writes = [];

  @override
  Future<ThemeChoice> read() async => stored;

  @override
  Future<void> write(ThemeChoice choice) async {
    if (failWrites) throw PlatformException(code: 'keystore');
    writes.add(choice);
    stored = choice;
  }
}
