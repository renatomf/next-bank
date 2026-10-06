import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:next_bank/core/api_failure.dart';
import 'package:next_bank/core/session/session_controller.dart';
import 'package:next_bank/features/auth/presentation/auth_providers.dart';

/// Whether the sign-out is running, discarded when its button goes away.
final NotifierProvider<SignOutController, bool> signOutControllerProvider =
    NotifierProvider.autoDispose<SignOutController, bool>(
      SignOutController.new,
    );

/// Ends the session on the server and on the device (AUTH-06).
class SignOutController extends Notifier<bool> {
  @override
  bool build() => false;

  /// Ignored while running, so a double tap sends one request.
  Future<void> signOut() async {
    if (state) return;
    state = true;
    final repository = ref.read(authRepositoryProvider);
    final session = ref.read(sessionProvider.notifier);
    try {
      await repository.logout();
    } on ApiFailure {
      // The device forgets the session anyway; on the server it ends when
      // its refresh token expires.
    } finally {
      await session.signOut();
    }
  }
}
