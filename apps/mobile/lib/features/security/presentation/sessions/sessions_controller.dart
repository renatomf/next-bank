import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:next_bank/core/api_failure.dart';
import 'package:next_bank/core/api_messages.dart';
import 'package:next_bank/features/security/domain/active_session.dart';
import 'package:next_bank/features/security/presentation/security_providers.dart';

/// The Security screen's list of sessions.
final class SessionsView {
  /// Creates the view.
  const new({required this.sessions, this.revoking, this.error});

  /// The active sessions, most recently used first.
  final List<ActiveSession> sessions;

  /// The session being ended, if any.
  final String? revoking;

  /// Why the last session could not be ended.
  final String? error;
}

/// The list, loaded while the Security screen is open. Not retried
/// automatically: offline, the screen offers "Tentar de novo".
final AsyncNotifierProvider<SessionsController, SessionsView>
sessionsControllerProvider = AsyncNotifierProvider.autoDispose(
  SessionsController.new,
  retry: (_, _) => null,
);

/// Lists the customer's sessions and ends the ones on other devices (screen
/// 14; ASVS session).
class SessionsController extends AsyncNotifier<SessionsView> {
  @override
  Future<SessionsView> build() async => SessionsView(
    sessions: await ref.read(securityRepositoryProvider).sessions(),
  );

  /// Ends the session [id], already confirmed by the customer. Ignored for
  /// this device's session (week 7 plan, D3) and while another one ends.
  Future<void> revoke(String id) async {
    final view = state.value;
    if (view == null || view.revoking != null) return;
    final target = view.sessions.where((session) => session.id == id);
    if (target.isEmpty || target.first.current) return;
    state = AsyncData(SessionsView(sessions: view.sessions, revoking: id));
    final repository = ref.read(securityRepositoryProvider);
    try {
      await repository.revoke(id);
    } on ApiFailure catch (failure) {
      // Already gone, ended by that device or a password change: the goal is
      // met, so only the list is read again.
      if (failure is! ApiRejected || failure.code != ApiErrorCode.notFound) {
        if (ref.mounted) {
          state = AsyncData(
            SessionsView(sessions: view.sessions, error: messageFor(failure)),
          );
        }
        return;
      }
    }
    try {
      final sessions = await repository.sessions();
      if (ref.mounted) state = AsyncData(SessionsView(sessions: sessions));
    } on ApiFailure catch (failure) {
      if (ref.mounted) {
        state = AsyncData(
          SessionsView(sessions: view.sessions, error: messageFor(failure)),
        );
      }
    }
  }
}
