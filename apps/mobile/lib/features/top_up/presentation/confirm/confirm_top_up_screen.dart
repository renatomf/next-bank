import 'dart:async';

import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:next_bank/core/account/account_providers.dart';
import 'package:next_bank/core/session/biometric_pin_store.dart';
import 'package:next_bank/core/statement/statement_controller.dart';
import 'package:next_bank/core/ui/common_copy.dart';
import 'package:next_bank/features/top_up/domain/top_up.dart';
import 'package:next_bank/features/top_up/presentation/confirm/confirm_top_up_controller.dart';

/// The confirmation of a top-up with the PIN (v1.1.0 plan, task 5b): what
/// was chosen, then the PIN, checked on the server (PIX-06), as in the Pix
/// review.
class ConfirmTopUpScreen extends ConsumerStatefulWidget {
  /// Creates the confirmation of the [draft]; the router says where each
  /// outcome goes.
  const new({
    required this.draft,
    required this.onBack,
    required this.onHome,
    required this.onDone,
    super.key,
  });

  /// What is being topped up.
  final TopUpDraft draft;

  /// Back to the number and the amount, to change them.
  final VoidCallback onBack;

  /// Back to the Home.
  final VoidCallback onHome;

  /// The server took the top-up.
  final ValueChanged<TopUp> onDone;

  @override
  ConsumerState<ConfirmTopUpScreen> createState() => _ConfirmTopUpScreenState();
}

class _ConfirmTopUpScreenState extends ConsumerState<ConfirmTopUpScreen> {
  final _pin = TextEditingController();

  @override
  void dispose() {
    _pin.dispose();
    super.dispose();
  }

  ConfirmTopUpController get _controller =>
      ref.read(confirmTopUpControllerProvider(widget.draft).notifier);

  void _onCompleted(String pin) {
    // The field forgets the PIN at once; the controller keeps it only while
    // its attempt has no answer (MOB-02).
    _pin.clear();
    unawaited(_finish(_controller.confirm(pin)));
  }

  Future<void> _finish(Future<TopUp?> topUp) async {
    final done = await topUp;
    if (done == null || !mounted) return;
    // The money moved: the balance and the statement are read again.
    ref
      ..invalidate(accountProvider)
      ..invalidate(statementProvider);
    widget.onDone(done);
  }

  /// Leaves the confirmation. With an answer still lost the top-up may have
  /// been done, so the customer is told first (F-39); opening the same one
  /// again brings back the same attempt.
  Future<void> _leave() async {
    final state = ref.read(confirmTopUpControllerProvider(widget.draft));
    if (state.outcomeUnknown) {
      final leave = await showConfirmDialog(
        context,
        title: 'A recarga pode ter sido feita',
        message:
            'Não conseguimos confirmar a recarga. Confira o extrato antes de '
            'fazer outra: se ela foi feita, aparece lá.',
        confirmLabel: 'Sair',
        cancelLabel: 'Ficar',
      );
      if (!leave || !mounted) return;
    }
    widget.onBack();
  }

  @override
  Widget build(BuildContext context) {
    final draft = widget.draft;
    final text = Theme.of(context).textTheme;
    final pending = ref.watch(
      confirmTopUpControllerProvider(draft).select((s) => s.outcomeUnknown),
    );
    return PopScope(
      canPop: !pending,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) unawaited(_leave());
      },
      child: Scaffold(
        body: GlowBackground(
          child: SafeArea(
            child: ListView(
              padding: const EdgeInsets.all(NbSpace.screen),
              children: [
                ScreenHeader(
                  title: 'Confirmar recarga',
                  icon: Icons.arrow_back,
                  iconLabel: 'Voltar',
                  onPressed: () => unawaited(_leave()),
                ),
                const SizedBox(height: NbSpace.xl),
                Center(child: MoneyText(cents: draft.amountCents)),
                const SizedBox(height: NbSpace.sm),
                Center(
                  child: Text(
                    'para ${draft.phoneMasked}',
                    style: text.bodySmall,
                  ),
                ),
                const SizedBox(height: NbSpace.xl),
                Row(
                  spacing: NbSpace.md,
                  children: [
                    InitialsAvatar(initials: draft.operator.initials),
                    Expanded(
                      child: Text(
                        'Recarga de celular ${draft.operator.name}',
                        style: context.nbText.bodyText,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: NbSpace.xl),
                ..._confirmation(),
              ],
            ),
          ),
        ),
      ),
    );
  }

  List<Widget> _confirmation() {
    final state = ref.watch(confirmTopUpControllerProvider(widget.draft));
    final error = state.error;
    if (state.blocked) {
      return [
        InfoNotice(message: error ?? ''),
        const SizedBox(height: NbSpace.xl),
        SecondaryButton(label: 'Voltar ao início', onPressed: widget.onHome),
      ];
    }
    if (state.outcomeUnknown) {
      // The same attempt goes again: never a new PIN, never a second top-up.
      return [
        InfoNotice(message: error ?? ''),
        const SizedBox(height: NbSpace.xl),
        PrimaryButton(
          label: CommonCopy.retry,
          onPressed: () => unawaited(_finish(_controller.retry())),
          loading: state.verifying,
        ),
      ];
    }
    // With biometrics on, they come first; the PIN stays (ADR 0004).
    final biometrics = ref.watch(biometricUnlockProvider).value ?? false;
    return [
      if (biometrics && !state.verifying) ...[
        PrimaryButton(
          label: 'Confirmar com biometria',
          onPressed: () =>
              unawaited(_finish(_controller.confirmWithBiometrics())),
        ),
        const SizedBox(height: NbSpace.lg),
      ],
      PinField(
        revealLabels: CommonCopy.revealSecret,
        label: 'Digite seu PIN para recarregar',
        controller: _pin,
        errorText: error,
        onCompleted: _onCompleted,
        enabled: !state.verifying,
      ),
      const SizedBox(height: NbSpace.lg),
      if (state.verifying)
        const Center(
          child: CircularProgressIndicator(semanticsLabel: 'Fazendo a recarga'),
        )
      else
        const SecureHint(text: 'Seu PIN é conferido no servidor'),
    ];
  }
}
