import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:next_bank/core/api_failure.dart';
import 'package:next_bank/core/api_messages.dart';
import 'package:next_bank/core/idempotency_key.dart';
import 'package:next_bank/core/profile/profile_controller.dart';
import 'package:next_bank/core/session/biometric_pin_store.dart';
import 'package:next_bank/core/session/session_controller.dart';
import 'package:next_bank/features/top_up/domain/top_up.dart';
import 'package:next_bank/features/top_up/presentation/top_up_providers.dart';

/// What the customer chose, confirmed with the PIN: plain values, so the
/// same choice finds the same confirmation.
typedef TopUpDraft = ({
  ({String id, String name, String initials}) operator,
  String phoneDigits,
  String phoneMasked,
  int amountCents,
});

/// An attempt whose answer has not come: its PIN and key go again together
/// (MOB-07).
typedef PendingTopUp = ({String pin, String key, bool fromBiometrics});

/// The attempts without an answer, by draft (F-39). They outlive the screen:
/// a top-up whose answer was lost may have been done, so leaving and opening
/// the same one again must carry the same key, and the server answers what
/// it recorded instead of topping up twice. Only in memory, each dropped on
/// its answer, and all of them on signing out (MOB-02).
final class PendingTopUps {
  final Map<TopUpDraft, PendingTopUp> _byDraft = {};

  /// The attempt of [draft] still without an answer, if any.
  PendingTopUp? of(TopUpDraft draft) => _byDraft[draft];

  /// Keeps [attempt] until [draft] is answered.
  void keep(TopUpDraft draft, PendingTopUp attempt) =>
      _byDraft[draft] = attempt;

  /// Forgets the attempt of [draft], answered.
  void drop(TopUpDraft draft) => _byDraft.remove(draft);
}

/// One set per signed-in customer: a new session starts with none.
final Provider<PendingTopUps> pendingTopUpsProvider = Provider((ref) {
  // Signing out starts it over; loading the session on start does not.
  ref.watch(sessionProvider.select((session) => session.value is SignedOut));
  return PendingTopUps();
});

/// The text of a top-up whose answer was lost.
const String _unknownOutcome =
    'Não conseguimos confirmar a recarga. Tente de novo: ela não será '
    'feita duas vezes.';

/// What the confirmation shows. Never holds the PIN (MOB-02).
final class ConfirmTopUpState {
  /// Creates the state; the default asks for the PIN.
  const new({
    this.verifying = false,
    this.blocked = false,
    this.outcomeUnknown = false,
    this.error,
  });

  /// True while the server checks the PIN and takes the money.
  final bool verifying;

  /// The PIN is locked: no PIN can be typed.
  final bool blocked;

  /// The answer was lost: only "Tentar de novo" is offered, with the same
  /// attempt (MOB-07).
  final bool outcomeUnknown;

  /// What went wrong, in the catalog's words.
  final String? error;
}

/// The confirmation of one draft, discarded when the screen closes, and with
/// it the PIN of an unanswered attempt.
final NotifierProvider<ConfirmTopUpController, ConfirmTopUpState> Function(
  TopUpDraft,
)
confirmTopUpControllerProvider = NotifierProvider.autoDispose
    .family<ConfirmTopUpController, ConfirmTopUpState, TopUpDraft>(
      ConfirmTopUpController.new,
    );

/// Tops up with the PIN checked on the server (PIX-06), as the Pix review
/// authorizes a Pix: one key per new attempt, the same key for a lost
/// answer, so a top-up is never done twice (ADR 0007, MOB-07).
class ConfirmTopUpController extends Notifier<ConfirmTopUpState> {
  /// Creates the controller of the [draft].
  new(this.draft);

  /// What is being topped up.
  final TopUpDraft draft;

  @override
  ConfirmTopUpState build() {
    // Opened again with an answer still lost: only the same attempt (F-39).
    final pending = ref.watch(pendingTopUpsProvider).of(draft);
    return pending == null
        ? const ConfirmTopUpState()
        : const ConfirmTopUpState(outcomeUnknown: true, error: _unknownOutcome);
  }

  bool get _busy => state.verifying || state.blocked || state.outcomeUnknown;

  /// Tops up with a newly typed [pin], under a new key. Ignored while a
  /// top-up runs, after the PIN was locked and while an earlier attempt has
  /// no answer.
  Future<TopUp?> confirm(String pin) {
    if (_busy) return Future.value();
    return _topUp((
      pin: pin,
      key: ref.read(idempotencyKeysProvider)(),
      fromBiometrics: false,
    ));
  }

  /// Tops up with the PIN biometrics release, under a new key, checked on
  /// the server like a typed one (D11, ADR 0004). A cancel does nothing; a
  /// PIN no longer kept asks for the typed one (MOB-11).
  Future<TopUp?> confirmWithBiometrics() async {
    if (_busy) return null;
    final store = ref.read(biometricPinStoreProvider);
    switch (await store.read()) {
      case BiometricPin(:final pin):
        if (!ref.mounted) return null;
        return await _topUp((
          pin: pin,
          key: ref.read(idempotencyKeysProvider)(),
          fromBiometrics: true,
        ));
      case BiometricCancelled():
        return null;
      case BiometricPinLost():
        await store.clear();
        if (ref.mounted) {
          state = const ConfirmTopUpState(
            error: 'A biometria foi desativada neste aparelho. Digite seu PIN.',
          );
        }
        return null;
    }
  }

  /// Repeats the attempt whose answer was lost, with its PIN and key, so the
  /// server answers with what it recorded. Null when there is none.
  Future<TopUp?> retry() {
    final pending = ref.read(pendingTopUpsProvider).of(draft);
    if (pending == null || state.verifying) return Future.value();
    return _topUp(pending);
  }

  Future<TopUp?> _topUp(PendingTopUp attempt) async {
    // Read now: the answer may come after the screen closed, and what it
    // decides about the attempt must still happen.
    final pending = ref.read(pendingTopUpsProvider)..keep(draft, attempt);
    state = const ConfirmTopUpState(verifying: true);
    try {
      final done = await ref
          .read(topUpRepositoryProvider)
          .create(
            operatorId: draft.operator.id,
            phoneDigits: draft.phoneDigits,
            amountCents: draft.amountCents,
            pin: attempt.pin,
            idempotencyKey: attempt.key,
          );
      pending.drop(draft);
      if (!ref.mounted) return null;
      state = const ConfirmTopUpState();
      return done;
    } on ApiFailure catch (failure) {
      final next = _stateAfter(failure);
      if (!next.outcomeUnknown) pending.drop(draft);
      if (!ref.mounted) return null;
      // Catalog: the account has no PIN; the profile read again sends the
      // router to the PIN creation.
      if (failure case ApiRejected(code: ApiErrorCode.pinNotCreated)) {
        ref.invalidate(profileProvider);
      }
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
      return null;
    }
  }
}

ConfirmTopUpState _stateAfter(ApiFailure failure) => switch (failure) {
  ApiUnreachable() ||
  ApiUnexpected() ||
  ApiRejected(
    code: ApiErrorCode.requestInProgress,
  ) => const ConfirmTopUpState(outcomeUnknown: true, error: _unknownOutcome),
  ApiRejected(code: ApiErrorCode.pinLocked || ApiErrorCode.pinResetRequired) =>
    ConfirmTopUpState(blocked: true, error: messageFor(failure)),
  ApiRejected() => ConfirmTopUpState(error: messageFor(failure)),
};
