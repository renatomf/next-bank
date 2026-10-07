import 'package:next_bank/core/profile/profile.dart';
import 'package:next_bank/core/profile/profile_repository.dart';

/// Fake [ProfileRepository]: answers with the account as the server sees it
/// and counts the calls; [answer] can hold a call open or make it fail.
class FakeProfileRepository implements ProfileRepository {
  new({this.name = 'Ana Souza', this.hasPin = true});

  String name;

  /// Whether the server holds a PIN for the account.
  bool hasPin;

  /// What the next call does before answering; by default nothing.
  Future<void> Function() answer = () async {};

  int fetches = 0;

  @override
  Future<Profile> fetch() async {
    fetches++;
    await answer();
    return Profile(name: name, hasPin: hasPin);
  }
}
