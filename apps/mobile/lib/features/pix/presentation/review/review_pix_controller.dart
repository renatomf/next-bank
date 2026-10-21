import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:next_bank/core/api_failure.dart';
import 'package:next_bank/core/api_messages.dart';
import 'package:next_bank/core/idempotency_key.dart';
import 'package:next_bank/core/profile/profile_controller.dart';
import 'package:next_bank/core/session/biometric_pin_store.dart';
import 'package:next_bank/features/pix/domain/pix_transfer.dart';
import 'package:next_bank/features/pix/presentation/pix_providers.dart';

/// What the review shows (screen 8). Never holds the PIN (MOB-02).
final class ReviewPixState {
  /// Creates the state; the default asks for the PIN.
  const new({
    this.verifying = false,
    this.blocked = false,
    this.finished = false,
    this.outcomeUnknown = false,
    this.error,
  });

  /// True while the server checks the PIN and moves the money.
  final bool verifying;

  /// The PIN is locked: no PIN can be typed (week 6 plan, D6).
  final bool blocked;

  /// The Pix expired or was already processed: only starting again is left.
  final bool finished;

  /// The answer was lost: only "Tentar de novo" is offered, with the same
  /// attempt (MOB-07).
  final bool outcomeUnknown;

  /// What went wrong, in the catalog's words.
  final String? error;
}

/// The review's state for one Pix, discarded when the screen closes, and
/// with it the PIN of an unanswered attempt.
final NotifierProvider<ReviewPixController, ReviewPixState> Function(String)
reviewPixControllerProvider = NotifierProvider.autoDispose
    .family<ReviewPixController, ReviewPixState, String>(
      ReviewPixController.new,
    );

/// Authorizes one Pix with the PIN checked on the server (PIX-06).
class ReviewPixController extends Notifier<ReviewPixState> {
  /// Creates the controller of the Pix [transferId].
  new(this.transferId);

  /// The Pix under review.
  final String transferId;

  // The attempt whose answer has not come: its PIN and key go again together
  // (MOB-07). Held only in memory and dropped on any answer (MOB-02).
  ({String pin, String key, bool fromBiometrics})? _unanswered;

  @override
  ReviewPixState build() {
    // A rebuild keeps this instance: the PIN must not outlive the state.
    _unanswered = null;
    return const ReviewPixState();
  }

  /// Authorizes with a newly typed [pin], under a new key. Ignored while an
  /// authorization runs, after the PIN was locked, after the Pix finished,
  /// and while an earlier attempt has no answer.
  Future<PixTransfer?> confirm(String pin) {
    if (state.verifying ||
        state.blocked ||
        state.finished ||
        state.outcomeUnknown) {
      return Future.value();
    }
    return _authorize((
      pin: pin,
      key: ref.read(idempotencyKeysProvider)(),
      fromBiometrics: false,
    ));
  }

  /// Authorizes with the PIN biometrics release, under a new key, checked on
  /// the server like a typed one (v1.1.0 plan, task 2; ADR 0004). A cancel
  /// does nothing; a PIN no longer kept asks for the typed one (MOB-11).
  Future<PixTransfer?> confirmWithBiometrics() async {
    if (state.verifying ||
        state.blocked ||
        state.finished ||
        state.outcomeUnknown) {
      return null;
    }
    final store = ref.read(biometricPinStoreProvider);
    switch (await store.read()) {
      case BiometricPin(:final pin):
        if (!ref.mounted) return null;
        return await _authorize((
          pin: pin,
          key: ref.read(idempotencyKeysProvider)(),
          fromBiometrics: true,
        ));
      case BiometricCancelled():
        return null;
      case BiometricPinLost():
        await store.clear();
        if (ref.mounted) {
          state = const ReviewPixState(
            error: 'A biometria foi desativada neste aparelho. Digite seu PIN.',
          );
        }
        return null;
    }
  }

  /// Repeats the attempt whose answer was lost, with its PIN and key, so the
  /// server answers with what it recorded. Null when there is none.
  Future<PixTransfer?> retry() {
    final unanswered = _unanswered;
    if (unanswered == null || state.verifying) return Future.value();
    return _authorize(unanswered);
  }

  Future<PixTransfer?> _authorize(
    ({String pin, String key, bool fromBiometrics}) attempt,
  ) async {
    _unanswered = attempt;
    state = const ReviewPixState(verifying: true);
    try {
      final transfer = await ref
          .read(pixRepositoryProvider)
          .authorize(
            transferId: transferId,
            pin: attempt.pin,
            idempotencyKey: attempt.key,
          );
      _unanswered = null;
      if (!ref.mounted) return null;
      state = const ReviewPixState();
      return transfer;
    } on ApiFailure catch (failure) {
      if (!ref.mounted) return null;
      // Catalog: the account has no PIN; the profile read again sends the
      // router to the PIN creation.
      if (failure case ApiRejected(code: ApiErrorCode.pinNotCreated)) {
        ref.invalidate(profileProvider);
      }
      final next = _stateAfter(failure);
      // A kept PIN the server refuses is out of date, and a locked PIN must
      // be reset with the password: either way, it is no longer kept.
      final refused =
          attempt.fromBiometrics &&
          failure is ApiRejected &&
          failure.code == ApiErrorCode.pinIncorrect;
      if (next.blocked || refused) {
        await ref.read(biometricPinStoreProvider).clear();
        if (!ref.mounted) return null;
      }
      state = next;
      if (!state.outcomeUnknown) _unanswered = null;
      return null;
    }
  }
}

ReviewPixState _stateAfter(ApiFailure failure) => switch (failure) {
  ApiUnreachable() ||
  ApiUnexpected() ||
  ApiRejected(code: ApiErrorCode.requestInProgress) => const ReviewPixState(
    outcomeUnknown: true,
    error:
        'Não conseguimos confirmar o Pix. Tente de novo: ele não será '
        'enviado duas vezes.',
  ),
  ApiRejected(code: ApiErrorCode.pinLocked || ApiErrorCode.pinResetRequired) =>
    ReviewPixState(blocked: true, error: messageFor(failure)),
  ApiRejected(
    code: ApiErrorCode.transferExpired || ApiErrorCode.invalidTransferState,
  ) =>
    ReviewPixState(finished: true, error: messageFor(failure)),
  ApiRejected() => ReviewPixState(error: messageFor(failure)),
};
