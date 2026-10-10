import 'package:next_bank/features/security/domain/active_session.dart';
import 'package:next_bank/features/security/domain/security_repository.dart';

/// A session for tests: the current one, or another device's.
ActiveSession session(String id, {bool current = false}) => ActiveSession(
  id: id,
  deviceLabel: current ? 'Android' : 'iOS',
  createdAt: DateTime(2026, 10, 9, 10),
  lastUsedAt: DateTime(2026, 10, 9, 12),
  current: current,
);

/// The security API without the network: [sessionsAnswer] and [answer]
/// script what each call does, and every call is recorded.
class FakeSecurityRepository implements SecurityRepository {
  /// What the next reads of the sessions return.
  Future<List<ActiveSession>> Function() sessionsAnswer = () async => [
    session('this-phone', current: true),
    session('old-tablet'),
  ];

  /// What the next commands do; by default they succeed.
  Future<void> Function() answer = () async {};

  /// How many times the sessions were read.
  int reads = 0;

  /// Sessions asked to end, in order.
  final List<String> revoked = [];

  /// PIN changes asked, in order.
  final List<({String password, String newPin})> pinChanges = [];

  /// Password changes asked, in order.
  final List<({String currentPassword, String newPassword})> passwordChanges =
      [];

  @override
  Future<List<ActiveSession>> sessions() {
    reads++;
    return sessionsAnswer();
  }

  @override
  Future<void> revoke(String id) {
    revoked.add(id);
    return answer();
  }

  @override
  Future<void> changePin({required String password, required String newPin}) {
    pinChanges.add((password: password, newPin: newPin));
    return answer();
  }

  @override
  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
  }) {
    passwordChanges.add((
      currentPassword: currentPassword,
      newPassword: newPassword,
    ));
    return answer();
  }
}
