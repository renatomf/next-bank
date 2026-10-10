import 'package:flutter/material.dart';

/// The theme the customer picks on the Profile (week 7 plan, D9).
enum ThemeChoice {
  /// Follows the phone's light or dark mode; the default.
  system(ThemeMode.system),

  /// Always light.
  light(ThemeMode.light),

  /// Always dark.
  dark(ThemeMode.dark);

  new(this.mode);

  /// What the app root applies.
  final ThemeMode mode;
}
