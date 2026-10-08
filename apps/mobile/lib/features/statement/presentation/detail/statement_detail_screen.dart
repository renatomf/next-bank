import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:next_bank/core/account/account_providers.dart';
import 'package:next_bank/core/clock.dart';
import 'package:next_bank/core/statement/statement_controller.dart';
import 'package:next_bank/core/statement/statement_item.dart';
import 'package:next_bank/core/statement/statement_texts.dart';

/// The detail of one movement (screen 12; D3): what the statement already
/// has, read from the pages loaded (T4-2). Only a Pix sent links to its
/// receipt, since only the payer reads a Pix (PIX-01).
class StatementDetailScreen extends ConsumerWidget {
  /// Creates the detail of the movement [itemId].
  const new({
    required this.itemId,
    required this.onBack,
    required this.onReceipt,
    super.key,
  });

  /// The movement shown.
  final String itemId;

  /// Back to where it was opened.
  final VoidCallback onBack;

  /// Opens the receipt of the Pix with this id.
  final ValueChanged<String> onReceipt;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final statement = ref.watch(statementProvider);
    return Scaffold(
      body: GlowBackground(
        child: SafeArea(
          child: ListView(
            padding: const EdgeInsets.all(NbSpace.screen),
            children: [
              ScreenHeader(
                title: 'Detalhe',
                icon: Icons.arrow_back,
                iconLabel: 'Voltar',
                onPressed: onBack,
              ),
              const SizedBox(height: NbSpace.xl),
              switch (statement) {
                AsyncData(:final value) => switch (value.itemById(itemId)) {
                  final StatementItem item => _Detail(
                    item: item,
                    onReceipt: onReceipt,
                  ),
                  null => const EmptyState(
                    icon: Icons.search_off,
                    title: 'Não encontrado.',
                    message: 'Volte ao extrato e escolha a movimentação.',
                  ),
                },
                AsyncError() => ErrorState(
                  message: 'Não foi possível carregar o extrato.',
                  onRetry: () => ref.invalidate(statementProvider),
                ),
                _ => const Center(
                  child: CircularProgressIndicator(
                    semanticsLabel: 'Carregando a movimentação',
                  ),
                ),
              },
            ],
          ),
        ),
      ),
    );
  }
}

class _Detail extends ConsumerWidget {
  const new({required this.item, required this.onReceipt});

  final StatementItem item;
  final ValueChanged<String> onReceipt;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.nbColors;
    final text = Theme.of(context).textTheme;
    final incoming = item.direction == MoneyDirection.incoming;
    final counterparty = item.counterparty;
    final document = counterparty?.documentMasked;
    final transferId = item.transferId;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Center(child: Text(statementTitle(item.kind), style: text.bodySmall)),
        const SizedBox(height: NbSpace.sm),
        Center(
          // In or out is said in words, never by color alone.
          child: Text(
            incoming ? 'Entrada' : 'Saída',
            style: NbType.caption.copyWith(color: colors.textMuted),
          ),
        ),
        const SizedBox(height: NbSpace.xs),
        Center(
          child: MoneyText(
            cents: item.amountCents,
            hidden: ref.watch(balanceHiddenProvider),
          ),
        ),
        const SizedBox(height: NbSpace.sm),
        Center(
          child: Text(
            movementTime(item.occurredAt, ref.watch(nowProvider)()),
            style: text.bodySmall,
          ),
        ),
        if (counterparty != null) ...[
          const SizedBox(height: NbSpace.xl),
          ContactCard(
            name: counterparty.name,
            detail: document == null
                ? 'next bank'
                : 'CPF $document · next bank',
            selected: false,
          ),
        ],
        if (transferId != null) ...[
          const SizedBox(height: NbSpace.xl),
          SecondaryButton(
            label: 'Ver comprovante',
            onPressed: () => onReceipt(transferId),
          ),
        ],
      ],
    );
  }
}
