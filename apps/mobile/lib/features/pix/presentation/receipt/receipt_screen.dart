import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:next_bank/core/account/account_providers.dart';
import 'package:next_bank/core/profile/profile_controller.dart';
import 'package:next_bank/core/receipt_texts.dart';
import 'package:next_bank/core/share/image_sharer.dart';
import 'package:next_bank/core/share/widget_png.dart';
import 'package:next_bank/core/ui/common_copy.dart';
import 'package:next_bank/core/ui/pix/receipt_card.dart';
import 'package:next_bank/features/pix/domain/pix_transfer.dart';
import 'package:next_bank/features/pix/presentation/pix_formats.dart';
import 'package:next_bank/features/pix/presentation/pix_providers.dart';
import 'package:next_bank/features/pix/presentation/receipt/shareable_receipt.dart';

/// The receipt of a Pix (screen 10; comprovante-dark mockup, without sharing,
/// decision D9). The payer is the customer: their name and their account's
/// last digits come from what the app already has (D10). Back and close never
/// lead to the PIN (domain-model.md 10): the router says where they go.
class ReceiptScreen extends ConsumerWidget {
  /// Creates the receipt of the Pix [transferId].
  const new({
    required this.transferId,
    required this.onClose,
    required this.onHome,
    super.key,
  });

  /// The Pix on the receipt.
  final String transferId;

  /// Back to the Home.
  final VoidCallback onHome;

  /// Closes the receipt: back to the statement detail it was opened from,
  /// or to the Home after a Pix just sent (T4-3).
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final transfer = ref.watch(pixTransferProvider(transferId));
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
                ...switch (transfer) {
                  AsyncData(value: final transfer) => [
                    _Receipt(transfer: transfer),
                  ],
                  AsyncError() => [
                    ErrorState(
                      retryLabel: CommonCopy.retry,
                      message: 'Não foi possível carregar o comprovante.',
                      onRetry: () =>
                          ref.invalidate(pixTransferProvider(transferId)),
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
  const new({required this.transfer});

  final PixTransfer transfer;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.nbColors;
    final text = Theme.of(context).textTheme;
    final name = ref.watch(profileProvider).value?.name ?? '';
    final account = ref.watch(accountProvider).value;
    final completed = transfer.status == PixStatus.completed;
    final payerAccount = account == null
        ? 'next bank'
        : payerDetail(branch: account.branch, number: account.number);
    return Column(
      children: [
        NbIconCircle(
          icon: completed ? Icons.check : Icons.close,
          size: NbSize.statusCircle,
          color: completed ? colors.accent : colors.danger,
          tone: NbIconCircleTone.tinted,
        ),
        const SizedBox(height: NbSpace.md),
        Text(
          completed ? 'Pix enviado' : 'Pix não enviado',
          style: text.bodySmall,
        ),
        const SizedBox(height: NbSpace.sm),
        MoneyText(cents: transfer.amountCents),
        const SizedBox(height: NbSpace.sm),
        Text('para ${transfer.payee.name}', style: text.bodyMedium),
        const SizedBox(height: NbSpace.xl),
        ReceiptCard(
          date: receiptDate(transfer.completedAt ?? transfer.createdAt),
          status: _badge(transfer.status),
          from: (name: name, detail: payerAccount),
          to: (name: transfer.payee.name, detail: payeeDetail(transfer.payee)),
          type: pixType(transfer.payee.keyType),
          description: transfer.description,
          transactionId: transfer.endToEndId,
        ),
        const SizedBox(height: NbSpace.md),
        Text(
          demoReceiptNotice,
          textAlign: TextAlign.center,
          style: text.bodySmall?.copyWith(color: colors.textMuted),
        ),
        // Only a completed Pix goes out as a receipt (DEMO-05).
        if (completed) ...[
          const SizedBox(height: NbSpace.xl),
          PrimaryButton(
            label: 'Compartilhar comprovante',
            onPressed: () => _share(ref, name: name, account: payerAccount),
          ),
        ],
      ],
    );
  }

  /// Draws the receipt image and hands it, alone, to the share sheet
  /// (v1.1.0 plan, task 1).
  Future<void> _share(
    WidgetRef ref, {
    required String name,
    required String account,
  }) async {
    final png = await ref.read(widgetPainterProvider)(
      ShareableReceipt(
        transfer: transfer,
        payerName: name,
        payerAccount: account,
      ),
      width: ShareableReceipt.width,
    );
    await ref
        .read(imageSharerProvider)
        .shareImage(png: png, fileName: 'comprovante-pix.png');
  }

  static StatusBadge _badge(PixStatus status) => switch (status) {
    PixStatus.completed => const StatusBadge(
      tone: StatusTone.success,
      label: 'Concluído',
    ),
    PixStatus.processing || PixStatus.awaitingAuth => const StatusBadge(
      tone: StatusTone.pending,
      label: 'Processando',
    ),
    PixStatus.failed || PixStatus.cancelled => const StatusBadge(
      tone: StatusTone.danger,
      label: 'Não concluído',
    ),
  };
}
