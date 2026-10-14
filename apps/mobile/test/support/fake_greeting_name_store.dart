import 'package:next_bank/core/session/greeting_name_store.dart';

/// The greeting name in memory instead of the Keystore.
class FakeGreetingNameStore implements GreetingNameStore {
  /// Creates the store, holding [name] if given.
  new([this.name]);

  /// The first name kept for the unlock greeting.
  String? name;

  @override
  Future<String?> read() async => name;

  @override
  Future<void> write(String firstName) async => name = firstName;

  @override
  Future<void> clear() async => name = null;
}
