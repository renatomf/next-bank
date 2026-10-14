import 'package:flutter_riverpod/flutter_riverpod.dart';

/// The customer's first name, kept on the device for the Unlock screen's
/// greeting: the only thing of the account shown before the PIN, by the
/// developer's choice (v1.1.0 plan, task 2; MOB-12). Gone on sign out.
abstract interface class GreetingNameStore {
  /// The kept first name, if any.
  Future<String?> read();

  /// Keeps [firstName].
  Future<void> write(String firstName);

  /// Forgets it.
  Future<void> clear();
}

/// Where the greeting name is kept; bound in main.dart.
final Provider<GreetingNameStore> greetingNameStoreProvider = Provider(
  (ref) => throw UnimplementedError('Bound in main.dart'),
);
