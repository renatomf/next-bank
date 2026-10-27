import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:next_bank/core/api_failure.dart';
import 'package:next_bank/core/api_messages.dart';
import 'package:next_bank/core/idempotency_key.dart';
import 'package:next_bank/features/pix/domain/br_code.dart';
import 'package:next_bank/features/pix/domain/pix_amount.dart';
import 'package:next_bank/features/pix/domain/pix_key_input.dart';
import 'package:next_bank/features/pix/domain/pix_transfer.dart';
import 'package:next_bank/features/pix/presentation/new_schedule/new_schedule_controller.dart';
import 'package:next_bank/features/pix/presentation/pix_formats.dart';
import 'package:next_bank/features/pix/presentation/pix_providers.dart';

/// Longest description a Pix takes (domain-model.md 3.4).
const int maxDescriptionLength = 140;

/// What the Pix screen shows (screen 7).
final class SendPixState {
  /// Creates the state; the default is an empty draft.
  const new({
    this.amountCents = 0,
    this.key = '',
    this.description = '',
    this.payee,
    this.searching = false,
    this.keyError,
    this.submitting = false,
    this.error,
    this.qrKey,
    this.amountLocked = false,
  });

  /// The amount typed, in integer cents (ADR 0006).
  final int amountCents;

  /// The CPF key as typed.
  final String key;

  /// The description as typed.
  final String description;

  /// Who holds [key], once looked up.
  final PixPayee? payee;

  /// True while the key is looked up.
  final bool searching;

  /// Why the key was not found.
  final String? keyError;

  /// True while the Pix is created.
  final bool submitting;

  /// Why the Pix was not created.
  final String? error;

  /// The key read from a QR Code, which takes the place of the typed CPF.
  final PixKeyRef? qrKey;

  /// Whether the amount came fixed in a QR Code and cannot be typed over
  /// (PIX-13).
  final bool amountLocked;

  /// Whether "Revisar Pix" can be pressed.
  bool get canSubmit =>
      payee != null &&
      isSendableAmount(amountCents) &&
      description.length <= maxDescriptionLength &&
      !searching &&
      !submitting;

  SendPixState _with({
    int? amountCents,
    String? key,
    String? description,
    PixPayee? Function()? payee,
    bool? searching,
    String? Function()? keyError,
    bool? submitting,
    String? Function()? error,
    PixKeyRef? Function()? qrKey,
    bool? amountLocked,
  }) => SendPixState(
    amountCents: amountCents ?? this.amountCents,
    key: key ?? this.key,
    description: description ?? this.description,
    payee: payee == null ? this.payee : payee(),
    searching: searching ?? this.searching,
    keyError: keyError == null ? this.keyError : keyError(),
    submitting: submitting ?? this.submitting,
    error: error == null ? this.error : error(),
    qrKey: qrKey == null ? this.qrKey : qrKey(),
    amountLocked: amountLocked ?? this.amountLocked,
  );
}

/// The Pix screen's state, discarded when the screen closes.
final NotifierProvider<SendPixController, SendPixState>
sendPixControllerProvider =
    NotifierProvider.autoDispose<SendPixController, SendPixState>(
      SendPixController.new,
    );

/// What one creation sent: repeating it must reuse its key (MOB-07).
typedef _Draft = ({PixKeyRef key, int amountCents, String? description});

const String _invalidQrCode = 'Este QR Code não é um Pix válido.';
const String _unsupportedKey =
    'Este QR Code usa uma chave que o next bank ainda não aceita.';

/// Fills in the Pix and creates it, waiting for the PIN (screen 7).
class SendPixController extends Notifier<SendPixState> {
  // The creation whose answer never came, kept to repeat it with its key.
  ({_Draft draft, String key})? _unanswered;

  @override
  SendPixState build() {
    // A rebuild keeps this instance: the key belongs to the draft it drops.
    _unanswered = null;
    return const SendPixState();
  }

  /// The amount field changed; anything but up to nine digits is ignored.
  void typeAmount(String digits) {
    if (state.amountLocked) return;
    final cents = centsFromDigits(digits);
    if (cents == null) return;
    state = state._with(amountCents: cents, error: () => null);
  }

  /// The key field changed: the payee found for the old key no longer holds.
  void typeKey(String key) {
    if (key == state.key && state.qrKey == null) return;
    // A typed key gives up the QR Code, and with it the fixed amount.
    state = state._with(
      key: key,
      payee: () => null,
      keyError: () => null,
      error: () => null,
      qrKey: () => null,
      amountLocked: false,
    );
  }

  /// Reads a QR Code or its "Copia e Cola" into the Pix; returns why it
  /// cannot be paid, or null once it fills the Pix. Checked whole before
  /// the server is asked (PIX-13); the name it carries is never used
  /// (PIX-11). Ignored while a key is looked up: the camera reports the
  /// same code many times.
  Future<String?> readQrCode(String text) async {
    if (state.searching) return null;
    final BrCodePayment payment;
    try {
      payment = parseBrCode(text);
    } on InvalidQrCode {
      return _invalidQrCode;
    } on UnsupportedPixKey {
      return _unsupportedKey;
    }
    final fixed = payment.amountCents;
    state = state._with(
      key: '',
      qrKey: () => (type: payment.keyType, value: payment.key),
      amountCents: fixed ?? state.amountCents,
      amountLocked: fixed != null,
      description: payment.message ?? state.description,
      payee: () => null,
      keyError: () => null,
      error: () => null,
    );
    await lookup();
    return null;
  }

  /// The description field changed.
  void typeDescription(String description) {
    state = state._with(description: description, error: () => null);
  }

  /// Looks up who holds the key typed, of any kind (v1.2.0 plan, task 5,
  /// A1), or read from a QR Code. A value no key can have never reaches the
  /// API, so it spends none of the hourly lookups (PIX-07).
  Future<void> lookup() async {
    if (state.searching) return;
    final typed = state.key;
    final qrKey = state.qrKey;
    final key = qrKey ?? pixKeyOf(typed);
    if (key == null) {
      state = state._with(keyError: () => 'Chave Pix inválida.');
      return;
    }
    // An answer for a key that was changed meanwhile is dropped.
    bool unchanged() => state.key == typed && state.qrKey == qrKey;
    state = state._with(searching: true, keyError: () => null);
    try {
      final payee = await ref.read(pixRepositoryProvider).lookup(key);
      if (!ref.mounted) return;
      state = state._with(
        searching: false,
        payee: () => unchanged() ? payee : null,
      );
    } on ApiFailure catch (failure) {
      if (!ref.mounted) return;
      state = state._with(
        searching: false,
        keyError: () => unchanged() ? messageFor(failure) : null,
      );
    }
  }

  /// What "Agendar" takes (v1.2.0 plan, task 7): the key, the payee as
  /// shown, the amount and the description; null until the Pix could be
  /// sent.
  ScheduleDraft? scheduleDraft() {
    final payee = state.payee;
    final key = state.qrKey ?? pixKeyOf(state.key);
    if (!state.canSubmit || payee == null || key == null) return null;
    final description = state.description.trim();
    return (
      key: key,
      payeeName: payee.name,
      payeeDetail: payeeDetail(payee),
      amountCents: state.amountCents,
      description: description.isEmpty ? null : description,
    );
  }

  /// Creates the Pix and returns its id for the review; null when it cannot
  /// be sent or was refused. Ignored while a creation runs.
  Future<String?> submit() async {
    if (!state.canSubmit) return null;
    final description = state.description.trim();
    // A payee was found, so the key typed is one (canSubmit).
    final typedKey = state.qrKey ?? pixKeyOf(state.key);
    if (typedKey == null) return null;
    final draft = (
      key: typedKey,
      amountCents: state.amountCents,
      description: description.isEmpty ? null : description,
    );
    final unanswered = _unanswered;
    final key = unanswered != null && unanswered.draft == draft
        ? unanswered.key
        : ref.read(idempotencyKeysProvider)();
    _unanswered = null;
    state = state._with(submitting: true, error: () => null);
    try {
      final transfer = await ref
          .read(pixRepositoryProvider)
          .create(
            key: draft.key,
            amountCents: draft.amountCents,
            description: draft.description,
            idempotencyKey: key,
          );
      if (!ref.mounted) return null;
      state = state._with(submitting: false);
      return transfer.id;
    } on ApiFailure catch (failure) {
      if (!ref.mounted) return null;
      // Without an answer the server may have created the Pix: the same
      // draft goes again with this key. An answer spends the key.
      if (_outcomeUnknown(failure)) _unanswered = (draft: draft, key: key);
      state = state._with(submitting: false, error: () => messageFor(failure));
      return null;
    }
  }
}

/// Whether the server may have done what was asked without the app knowing.
bool _outcomeUnknown(ApiFailure failure) => switch (failure) {
  ApiUnreachable() || ApiUnexpected() => true,
  ApiRejected(code: ApiErrorCode.requestInProgress) => true,
  ApiRejected() => false,
};
