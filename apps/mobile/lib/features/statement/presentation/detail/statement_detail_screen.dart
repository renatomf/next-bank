import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:next_bank/core/clock.dart';
import 'package:next_bank/core/statement/statement_controller.dart';
import 'package:next_bank/core/statement/statement_item.dart';
import 'package:next_bank/core/statement/statement_texts.dart';
import 'package:next_bank/core/ui/common_copy.dart';
import 'package:next_bank/core/ui/pix/contact_card.dart';

/// The detail of one movement (screen 12; D3): what the statement already
/// has, read from the pages loaded (T4-2). Only a Pix sent links to its
/// receipt, since only the payer reads a Pix (PIX-01); a top-up links to its
/// own.
class StatementDetailScreen extends ConsumerWidget {
  /// Creates the detail of the movement [itemId].
  const new({
    required this.itemId,
    required this.onBack,
    required this.onReceipt,
    required this.onTopUpReceipt,
    super.key,
  });

  /// The movement shown.
  final String itemId;

  /// Back to where it was opened.
  final VoidCallback onBack;

  /// Opens the receipt of the Pix with this id.
  final ValueChanged<String> onReceipt;

  /// Opens the receipt of the top-up with this id.
  final ValueChanged<String> onTopUpReceipt;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Opened from the statement screen, the movement may be only in its
    // filtered list; from the Home, in the whole statement.
    final statement = ref.exists(filteredStatementProvider)
        ? ref.watch(filteredStatementProvider)
        : ref.watch(statementProvider);
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
                    onTopUpReceipt: onTopUpReceipt,
                  ),
                  null => const EmptyState(
                    icon: Icons.search_off,
                    title: 'Não encontrado.',
                    message: 'Volte ao extrato e escolha a movimentação.',
                  ),
                },
                AsyncError() => ErrorState(
                  retryLabel: CommonCopy.retry,
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

/// What the masked document is: a top-up's is the number recharged, and a
/// Pix's the other customer's CPF (F-38).
String _detailOf(StatementKind kind, String? document) => switch (kind) {
  StatementKind.topUp => document == null ? 'Celular' : 'Celular $document',
  _ => document == null ? 'next bank' : 'CPF $document · next bank',
};

class _Detail extends ConsumerWidget {
  const new({
    required this.item,
    required this.onReceipt,
    required this.onTopUpReceipt,
  });

  final StatementItem item;
  final ValueChanged<String> onReceipt;
  final ValueChanged<String> onTopUpReceipt;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = Theme.of(context).textTheme;
    final incoming = item.direction == MoneyDirection.incoming;
    final counterparty = item.counterparty;
    final document = counterparty?.documentMasked;
    final transferId = item.transferId;
    final topUpId = item.topUpId;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Center(child: Text(statementTitle(item.kind), style: text.bodySmall)),
        const SizedBox(height: NbSpace.sm),
        Center(
          // In or out is said in words, never by color alone.
          child: Text(
            incoming ? 'Entrada' : 'Saída',
            style: context.nbText.caption,
          ),
        ),
        const SizedBox(height: NbSpace.xs),
        Center(child: MoneyText(cents: item.amountCents)),
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
            detail: _detailOf(item.kind, document),
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
        if (topUpId != null) ...[
          const SizedBox(height: NbSpace.xl),
          SecondaryButton(
            label: 'Ver comprovante',
            onPressed: () => onTopUpReceipt(topUpId),
          ),
        ],
      ],
    );
  }
}
