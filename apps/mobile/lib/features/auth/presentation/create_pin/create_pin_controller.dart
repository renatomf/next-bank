import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:next_bank/core/api_failure.dart';
import 'package:next_bank/core/api_messages.dart';
import 'package:next_bank/core/profile/profile_controller.dart';
import 'package:next_bank/features/auth/domain/pin_rules.dart';
import 'package:next_bank/features/auth/presentation/auth_providers.dart';

/// What the PIN creation screen shows. Never holds the PIN: the screen keeps
/// the typed digits only until they are sent (MOB-02).
final class CreatePinState {
  /// Creates the state; the default is the first step, with no error.
  const new({this.sending = false, this.created = false, this.error});

  /// True while the PIN is being created.
  final bool sending;

  /// The account has its PIN: the app moves on to the home.
  final bool created;

  /// Why the PIN was refused or could not be created.
  final String? error;
}

/// The PIN creation screen's state, discarded when the screen closes.
final NotifierProvider<CreatePinController, CreatePinState>
createPinControllerProvider =
    NotifierProvider.autoDispose<CreatePinController, CreatePinState>(
      CreatePinController.new,
    );

/// Creates the transaction PIN in two steps: type it, then confirm it.
class CreatePinController extends Notifier<CreatePinState> {
  static final String _trivialPin = messageFor(
    const ApiRejected(ApiErrorCode.invalidPin),
  );

  @override
  CreatePinState build() => const CreatePinState();

  /// The first step: true when [pin] can be confirmed; a trivial PIN is
  /// refused here, before the visitor types it twice.
  bool check(String pin) {
    final acceptable = isAcceptablePin(pin);
    state = acceptable
        ? const CreatePinState()
        : CreatePinState(error: _trivialPin);
    return acceptable;
  }

  /// Creates the PIN once the [confirmation] matches. Ignored while
  /// running, so a double tap sends one request.
  Future<void> submit({
    required String pin,
    required String confirmation,
  }) async {
    if (state.sending) return;
    if (pin != confirmation) {
      state = const CreatePinState(
        error: 'Os PINs não conferem. Digite de novo.',
      );
      return;
    }
    if (!isAcceptablePin(pin)) {
      state = CreatePinState(error: _trivialPin);
      return;
    }

    state = const CreatePinState(sending: true);
    final repository = ref.read(authRepositoryProvider);
    try {
      await repository.createPin(pin);
      _created();
    } on ApiFailure catch (failure) {
      if (!ref.mounted) return;
      switch (failure) {
        // The account already has a PIN: what this screen is for is done.
        case ApiRejected(code: ApiErrorCode.pinAlreadyCreated):
          _created();
        case _:
          state = CreatePinState(error: messageFor(failure));
      }
    }
  }

  // The profile learns it too, or the navigation would bring the account
  // back to this screen.
  void _created() {
    if (!ref.mounted) return;
    ref.read(profileProvider.notifier).pinCreated();
    state = const CreatePinState(created: true);
  }
}
