import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:next_bank/core/account/account_providers.dart';
import 'package:next_bank/core/profile/profile_controller.dart';
import 'package:next_bank/core/receipt_texts.dart';
import 'package:next_bank/core/ui/common_copy.dart';
import 'package:next_bank/core/ui/pix/receipt_card.dart';
import 'package:next_bank/features/top_up/domain/top_up.dart';
import 'package:next_bank/features/top_up/presentation/top_up_providers.dart';

/// The receipt of a top-up (v1.1.0 plan, task 5b), read from the server,
/// only for its owner (READ-01) and with the number masked (READ-02). Not
/// shared as an image yet (R8). Back and close never lead to the PIN: the
/// router says where they go.
class TopUpReceiptScreen extends ConsumerWidget {
  /// Creates the receipt of the top-up [topUpId].
  const new({
    required this.topUpId,
    required this.onClose,
    required this.onHome,
    super.key,
  });

  /// The top-up on the receipt.
  final String topUpId;

  /// Closes the receipt: back to the statement detail it was opened from,
  /// or to the Home after a top-up just done.
  final VoidCallback onClose;

  /// Back to the Home.
  final VoidCallback onHome;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final topUp = ref.watch(topUpProvider(topUpId));
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) onClose();
      },
      child: Scaffold(
        body: GlowBackground(
          child: SafeArea(
            child: ListView(
              padding: const EdgeInsets.all(NbSpace.screen),
              children: [
                ScreenHeader(
                  title: 'Comprovante',
                  icon: Icons.close,
                  iconLabel: 'Fechar',
                  onPressed: onClose,
                ),
                const SizedBox(height: NbSpace.xl),
                ...switch (topUp) {
                  AsyncData(:final value) => [_Receipt(topUp: value)],
                  AsyncError() => [
                    ErrorState(
                      retryLabel: CommonCopy.retry,
                      message: 'Não foi possível carregar o comprovante.',
                      onRetry: () => ref.invalidate(topUpProvider(topUpId)),
                    ),
                  ],
                  _ => const [
                    Center(
                      child: CircularProgressIndicator(
                        semanticsLabel: 'Carregando o comprovante',
                      ),
                    ),
                  ],
                },
                const SizedBox(height: NbSpace.xl),
                SecondaryButton(label: 'Voltar ao início', onPressed: onHome),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _Receipt extends ConsumerWidget {
  const new({required this.topUp});

  final TopUp topUp;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.nbColors;
    final text = Theme.of(context).textTheme;
    final name = ref.watch(profileProvider).value?.name ?? '';
    final account = ref.watch(accountProvider).value;
    return Column(
      children: [
        NbIconCircle(
          icon: Icons.check,
          size: NbSize.statusCircle,
          color: colors.accent,
          tone: NbIconCircleTone.tinted,
        ),
        const SizedBox(height: NbSpace.md),
        Text('Recarga feita', style: text.bodySmall),
        const SizedBox(height: NbSpace.sm),
        MoneyText(cents: topUp.amountCents),
        const SizedBox(height: NbSpace.sm),
        Text('para ${topUp.phoneMasked}', style: text.bodyMedium),
        const SizedBox(height: NbSpace.xl),
        ReceiptCard(
          date: receiptDate(topUp.createdAt),
          // Every top-up completes in this version (D5).
          status: const StatusBadge(
            tone: StatusTone.success,
            label: 'Concluída',
          ),
          from: (
            name: name,
            detail: account == null
                ? 'next bank'
                : payerDetail(branch: account.branch, number: account.number),
          ),
          to: (
            name: topUp.operatorName,
            detail: 'Celular ${topUp.phoneMasked}',
          ),
          type: 'Recarga de celular',
          transactionId: topUp.id,
        ),
        const SizedBox(height: NbSpace.md),
        Text(
          demoReceiptNotice,
          textAlign: TextAlign.center,
          style: text.bodySmall?.copyWith(color: colors.textMuted),
        ),
      ],
    );
  }
}
