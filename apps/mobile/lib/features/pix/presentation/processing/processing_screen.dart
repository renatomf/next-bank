import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:next_bank/core/ui/common_copy.dart';
import 'package:next_bank/features/pix/domain/pix_transfer.dart';
import 'package:next_bank/features/pix/presentation/processing/processing_controller.dart';

/// A Pix being processed, or why it failed (screen 9). Back always goes to
/// the Home, never to the PIN (domain-model.md 10).
class ProcessingScreen extends ConsumerWidget {
  /// Creates the screen of the Pix [transferId].
  const new({
    required this.transferId,
    required this.onHome,
    required this.onReceipt,
    super.key,
  });

  /// The Pix being followed.
  final String transferId;

  /// Back to the Home.
  final VoidCallback onHome;

  /// Shows the receipt once the money moved.
  final VoidCallback onReceipt;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final provider = processingControllerProvider(transferId);
    ref.listen(provider, (_, next) {
      if (next case AsyncData(
        value: PixTransfer(status: PixStatus.completed),
      )) {
        onReceipt();
      }
    });
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) onHome();
      },
      child: Scaffold(
        body: GlowBackground(
          child: SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(NbSpace.screen),
              child: switch (ref.watch(provider)) {
                AsyncData(value: final transfer) => _Outcome(
                  transfer: transfer,
                  onHome: onHome,
                ),
                AsyncError() => Center(
                  child: ErrorState(
                    retryLabel: CommonCopy.retry,
                    message: 'Não foi possível consultar o Pix.',
                    onRetry: () => ref.invalidate(provider),
                  ),
                ),
                _ => const _Processing(),
              },
            ),
          ),
        ),
      ),
    );
  }
}

class _Processing extends StatelessWidget {
  const new();

  @override
  Widget build(BuildContext context) => Center(
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const CircularProgressIndicator(),
        const SizedBox(height: NbSpace.xl),
        Text(
          'Processando seu Pix',
          style: Theme.of(context).textTheme.headlineSmall,
        ),
      ],
    ),
  );
}

class _Outcome extends StatelessWidget {
  const new({required this.transfer, required this.onHome});

  final PixTransfer transfer;
  final VoidCallback onHome;

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;
    final text = Theme.of(context).textTheme;
    final reason = transfer.failureReason;
    final (icon, color, title, message) = switch (transfer.status) {
      // The receipt opens; this shows only for a moment.
      PixStatus.completed => (Icons.check, colors.success, 'Pix enviado', ''),
      PixStatus.failed => (
        Icons.close,
        colors.danger,
        'Pix não enviado',
        reason == null ? '' : failureText(reason),
      ),
      PixStatus.processing => (
        Icons.schedule,
        colors.textMuted,
        'Ainda processando',
        'Acompanhe o resultado no extrato.',
      ),
      PixStatus.awaitingAuth || PixStatus.cancelled => (
        Icons.close,
        colors.danger,
        'Pix não enviado',
        'Este Pix não foi concluído.',
      ),
    };
    return Column(
      children: [
        const Spacer(),
        NbIconCircle(
          icon: icon,
          size: NbSize.statusCircle,
          color: color,
          tone: NbIconCircleTone.tinted,
        ),
        const SizedBox(height: NbSpace.xl),
        Semantics(header: true, child: Text(title, style: text.headlineSmall)),
        const SizedBox(height: NbSpace.sm),
        Text(message, textAlign: TextAlign.center, style: text.bodySmall),
        const Spacer(),
        SecondaryButton(label: 'Voltar ao início', onPressed: onHome),
      ],
    );
  }
}
