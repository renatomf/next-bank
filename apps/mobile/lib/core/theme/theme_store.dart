import 'package:next_bank/core/theme/theme_choice.dart';

/// Where the theme choice survives app restarts. It belongs to the device,
/// not to the customer, so signing out keeps it.
abstract interface class ThemeStore {
  /// The kept choice; [ThemeChoice.system] when there is none.
  Future<ThemeChoice> read();

  /// Keeps [choice].
  Future<void> write(ThemeChoice choice);
}
