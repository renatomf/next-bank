import 'dart:async';

import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:next_bank/core/account/account_providers.dart';
import 'package:next_bank/core/session/biometric_pin_store.dart';
import 'package:next_bank/core/statement/statement_controller.dart';
import 'package:next_bank/core/ui/common_copy.dart';
import 'package:next_bank/core/ui/pix/contact_card.dart';
import 'package:next_bank/features/pix/domain/pix_transfer.dart';
import 'package:next_bank/features/pix/presentation/pix_formats.dart';
import 'package:next_bank/features/pix/presentation/pix_providers.dart';
import 'package:next_bank/features/pix/presentation/review/review_pix_controller.dart';

/// The review of a Pix with the PIN (screen 8): what the server recorded,
/// then the PIN, checked on the server (PIX-06).
class ReviewPixScreen extends ConsumerStatefulWidget {
  /// Creates the review of the Pix [transferId]; the router says where each
  /// outcome goes.
  const new({
    required this.transferId,
    required this.onBack,
    required this.onHome,
    required this.onFinished,
    super.key,
  });

  /// The Pix under review.
  final String transferId;

  /// Back to the Pix screen, to change it or start again.
  final VoidCallback onBack;

  /// Back to the Home.
  final VoidCallback onHome;

  /// The server answered the authorization with this Pix.
  final ValueChanged<PixTransfer> onFinished;

  @override
  ConsumerState<ReviewPixScreen> createState() => _ReviewPixScreenState();
}

class _ReviewPixScreenState extends ConsumerState<ReviewPixScreen> {
  final _pin = TextEditingController();

  @override
  void dispose() {
    _pin.dispose();
    super.dispose();
  }

  ReviewPixController get _controller =>
      ref.read(reviewPixControllerProvider(widget.transferId).notifier);

  void _onCompleted(String pin) {
    // The field forgets the PIN at once; the controller keeps it only while
    // its attempt has no answer (MOB-02).
    _pin.clear();
    unawaited(_finish(_controller.confirm(pin)));
  }

  Future<void> _finish(Future<PixTransfer?> authorization) async {
    final transfer = await authorization;
    if (transfer == null || !mounted) return;
    // What was read before the PIN is stale now: the Pix, and, since the money
    // may have moved, the balance and the statement. The screens that show
    // them read them again instead of showing the old ones.
    ref
      ..invalidate(pixTransferProvider(widget.transferId))
      ..invalidate(accountProvider)
      ..invalidate(statementProvider);
    widget.onFinished(transfer);
  }

  @override
  Widget build(BuildContext context) {
    final transfer = ref.watch(pixTransferProvider(widget.transferId));
    return Scaffold(
      body: GlowBackground(
        child: SafeArea(
          child: ListView(
            padding: const EdgeInsets.all(NbSpace.screen),
            children: [
              ScreenHeader(
                title: 'Revisar Pix',
                icon: Icons.arrow_back,
                iconLabel: 'Voltar',
                onPressed: widget.onBack,
              ),
              const SizedBox(height: NbSpace.xl),
              ...switch (transfer) {
                AsyncData(value: final transfer) => _review(transfer),
                AsyncError() => [
                  ErrorState(
                    retryLabel: CommonCopy.retry,
                    message: 'Não foi possível carregar o Pix.',
                    onRetry: () =>
                        ref.invalidate(pixTransferProvider(widget.transferId)),
                  ),
                ],
                _ => const [
                  Center(
                    child: CircularProgressIndicator(
                      semanticsLabel: 'Carregando o Pix',
                    ),
                  ),
                ],
              },
            ],
          ),
        ),
      ),
    );
  }

  List<Widget> _review(PixTransfer transfer) {
    final text = Theme.of(context).textTheme;
    final description = transfer.description;
    return [
      Center(child: MoneyText(cents: transfer.amountCents)),
      const SizedBox(height: NbSpace.sm),
      Center(child: Text('para ${transfer.payee.name}', style: text.bodySmall)),
      const SizedBox(height: NbSpace.xl),
      ContactCard(
        name: transfer.payee.name,
        detail: payeeDetail(transfer.payee),
        selected: false,
      ),
      if (description != null) ...[
        const SizedBox(height: NbSpace.lg),
        Text('Descrição', style: text.bodySmall),
        const SizedBox(height: NbSpace.xs),
        Text(description, style: text.bodyMedium),
      ],
      const SizedBox(height: NbSpace.xl),
      // A Pix reopened after it was sent is not authorized again.
      if (transfer.status != PixStatus.awaitingAuth)
        ..._finished('Este Pix já foi processado.')
      else
        ..._authorization(),
    ];
  }

  List<Widget> _authorization() {
    final state = ref.watch(reviewPixControllerProvider(widget.transferId));
    final error = state.error;
    if (state.finished) return _finished(error ?? '');
    if (state.blocked) {
      return [
        InfoNotice(message: error ?? ''),
        const SizedBox(height: NbSpace.xl),
        SecondaryButton(label: 'Voltar ao início', onPressed: widget.onHome),
      ];
    }
    if (state.outcomeUnknown) {
      // The same attempt goes again: never a new PIN, never a second Pix.
      return [
        InfoNotice(message: error ?? ''),
        const SizedBox(height: NbSpace.xl),
        PrimaryButton(
          label: 'Tentar de novo',
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
        label: 'Digite seu PIN para enviar',
        controller: _pin,
        errorText: error,
        onCompleted: _onCompleted,
        enabled: !state.verifying,
      ),
      const SizedBox(height: NbSpace.lg),
      if (state.verifying)
        const Center(
          child: CircularProgressIndicator(semanticsLabel: 'Enviando seu Pix'),
        )
      else
        const SecureHint(text: 'Seu PIN é conferido no servidor'),
    ];
  }

  List<Widget> _finished(String message) => [
    InfoNotice(message: message),
    const SizedBox(height: NbSpace.xl),
    SecondaryButton(label: 'Começar de novo', onPressed: widget.onBack),
  ];
}
