import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:next_bank/core/api_failure.dart';
import 'package:next_bank/core/api_messages.dart';
import 'package:next_bank/features/pix/domain/br_code.dart';
import 'package:next_bank/features/pix/domain/pix_amount.dart';
import 'package:next_bank/features/pix/domain/receiving_key.dart';
import 'package:next_bank/features/pix/presentation/pix_providers.dart';

final RegExp _printableAscii = RegExp(r'^[\x20-\x7E]*$');

/// What the "Receber" screen shows (v1.1.0 plan, task 3).
final class ReceivePixState {
  /// Creates the state; the default is loading, before any key.
  const new({
    this.loading = true,
    this.key,
    this.receiverName,
    this.error,
    this.amountCents = 0,
    this.message = '',
  });

  /// True while the key is asked for.
  final bool loading;

  /// The customer's random key, once loaded.
  final ReceivingKey? key;

  /// The name the code carries.
  final String? receiverName;

  /// Why there is no code.
  final String? error;

  /// The amount asked, in integer cents (ADR 0006); zero leaves it to the
  /// payer.
  final int amountCents;

  /// The message as typed.
  final String message;

  /// The key with only its ends showing, for the screen's text.
  String? get keyMasked => key?.keyMasked;

  /// The BR Code behind the QR Code and the "Copia e Cola"; null until the
  /// key and the name are known.
  String? get code {
    final key = this.key;
    final name = receiverName;
    if (key == null || name == null) return null;
    return staticBrCode(
      key: key.key,
      receiverName: name,
      amountCents: amountCents == 0 ? null : amountCents,
      message: message,
    );
  }

  ReceivePixState _with({
    bool? loading,
    ReceivingKey? key,
    String? receiverName,
    String? Function()? error,
    int? amountCents,
    String? message,
  }) => ReceivePixState(
    loading: loading ?? this.loading,
    key: key ?? this.key,
    receiverName: receiverName ?? this.receiverName,
    error: error == null ? this.error : error(),
    amountCents: amountCents ?? this.amountCents,
    message: message ?? this.message,
  );
}

/// The "Receber" screen's state, discarded when the screen closes.
final NotifierProvider<ReceivePixController, ReceivePixState>
receivePixControllerProvider =
    NotifierProvider.autoDispose<ReceivePixController, ReceivePixState>(
      ReceivePixController.new,
    );

/// Loads the customer's random key and builds the code to receive with.
class ReceivePixController extends Notifier<ReceivePixState> {
  Future<void>? _loading;

  @override
  ReceivePixState build() {
    _loading = null;
    return const ReceivePixState();
  }

  /// Asks for the key; a call while one runs waits for it instead.
  Future<void> load() => _loading ??= _load().whenComplete(() {
    _loading = null;
  });

  Future<void> _load() async {
    state = state._with(loading: true, error: () => null);
    // The code carries the customer's name: without it there is no code.
    final name = ref.read(receiverNameProvider);
    if (name == null) {
      state = state._with(
        loading: false,
        error: () => messageFor(const ApiUnexpected()),
      );
      return;
    }
    try {
      final key = await ref.read(pixRepositoryProvider).receivingKey();
      if (!ref.mounted) return;
      state = state._with(loading: false, key: key, receiverName: name);
    } on ApiFailure catch (failure) {
      if (!ref.mounted) return;
      state = state._with(loading: false, error: () => messageFor(failure));
    }
  }

  /// The amount field changed; anything but up to nine digits is ignored.
  void typeAmount(String digits) {
    final cents = centsFromDigits(digits);
    if (cents == null) return;
    state = state._with(amountCents: cents);
  }

  /// The message field changed; what the code cannot carry is ignored
  /// (DEMO-04).
  void typeMessage(String message) {
    final text = brCodeMessageText(message);
    if (text.length > maxBrCodeMessageLength ||
        !_printableAscii.hasMatch(text)) {
      return;
    }
    state = state._with(message: message);
  }
}
