import 'dart:async';

import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:next_bank/core/account/account_providers.dart';
import 'package:next_bank/core/api_failure.dart';
import 'package:next_bank/core/clock.dart';
import 'package:next_bank/core/refresh_failure.dart';
import 'package:next_bank/core/statement/statement_controller.dart';
import 'package:next_bank/core/statement/statement_item.dart';
import 'package:next_bank/core/statement/statement_query.dart';
import 'package:next_bank/core/statement/statement_texts.dart';
import 'package:next_bank/core/ui/balance/balance_card.dart';
import 'package:next_bank/core/ui/common_copy.dart';
import 'package:next_bank/core/ui/statement/transaction_item.dart';

/// The statement (screen 11, redesigned in v1.1.0, task 4.1): back and the
/// title on top, the balance card with its actions, the filters, the
/// search by name and the movements, newest first, the next page as the
/// customer nears the end, pull to refresh. Filters and search run on the
/// server (X1).
class StatementScreen extends ConsumerStatefulWidget {
  /// Creates the screen; the router says where each action goes.
  const new({
    required this.onBack,
    required this.onItem,
    required this.onPay,
    required this.onPix,
    super.key,
  });

  /// Leaves the statement, back to the Home.
  final VoidCallback onBack;

  /// Opens the detail of a movement.
  final ValueChanged<String> onItem;

  /// Opens the reading of a Pix QR Code.
  final VoidCallback onPay;

  /// Opens the Pix.
  final VoidCallback onPix;

  @override
  ConsumerState<StatementScreen> createState() => _StatementScreenState();
}

class _StatementScreenState extends ConsumerState<StatementScreen> {
  // The search waits for a pause in the typing before asking the server.
  static const Duration _searchPause = Duration(milliseconds: 400);
  Timer? _searchTimer;

  @override
  void dispose() {
    _searchTimer?.cancel();
    super.dispose();
  }

  void _typeSearch(String text) {
    _searchTimer?.cancel();
    _searchTimer = Timer(_searchPause, () {
      if (mounted) ref.read(statementQueryProvider.notifier).search(text);
    });
  }

  @override
  Widget build(BuildContext context) {
    final statement = ref.watch(filteredStatementProvider);
    final query = ref.watch(statementQueryProvider);
    final hidden = ref.watch(balanceHiddenProvider);
    final account = ref.watch(accountProvider).value;
    toastFailedRefresh(context, ref, filteredStatementProvider);
    final header = [
      BalanceCard(
        accountNumber: account?.number,
        balanceCents: account?.availableBalanceCents,
        hidden: hidden,
        // The same choice as the Home's and the Pix's (MOB-05).
        onToggleHidden: ref.read(balanceHiddenProvider.notifier).toggle,
        actions: [
          (
            icon: Icons.ios_share,
            label: 'Exportar',
            onPressed: () =>
                showNbToast(context, 'Em breve.', icon: Icons.info_outline),
          ),
          (
            icon: Icons.qr_code_scanner,
            label: 'Pagar',
            onPressed: widget.onPay,
          ),
          (icon: Icons.pix, label: 'Fazer Pix', onPressed: widget.onPix),
        ],
      ),
      const SizedBox(height: NbSpace.xl),
      _Filters(selected: query.filter),
      const SizedBox(height: NbSpace.lg),
      NbSearchField(
        hint: 'Busque a transação por nome',
        // The server takes up to 60 characters (READ-04).
        maxLength: 60,
        onChanged: _typeSearch,
      ),
      const SizedBox(height: NbSpace.lg),
    ];
    return Scaffold(
      body: GlowBackground(
        child: SafeArea(
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.all(NbSpace.screen),
                child: ScreenHeader(
                  title: 'Extrato',
                  icon: Icons.arrow_back,
                  iconLabel: 'Voltar',
                  onPressed: widget.onBack,
                ),
              ),
              Expanded(
                child: RefreshIndicator(
                  onRefresh: () async {
                    ref.invalidate(accountProvider);
                    try {
                      await ref
                          .read(filteredStatementProvider.notifier)
                          .refresh();
                    } on ApiFailure {
                      // Told by the toast; the list stays.
                    }
                  },
                  child: _Content(
                    header: header,
                    statement: statement,
                    filtered: query != allMovements,
                    onItem: widget.onItem,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// One filter at a time (X2); tapping the one on turns it off.
class _Filters extends ConsumerWidget {
  const new({required this.selected});

  final StatementFilter? selected;

  static const List<(StatementFilter, String, IconData)> _filters = [
    (StatementFilter.incoming, 'Entrada', Icons.south_west),
    (StatementFilter.outgoing, 'Saída', Icons.north_east),
    (StatementFilter.pix, 'Pix', Icons.pix),
    (StatementFilter.receipt, 'Comprovante', Icons.attach_file),
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) => SizedBox(
    height: MediaQuery.textScalerOf(context).scale(44),
    child: ListView.separated(
      scrollDirection: Axis.horizontal,
      itemCount: _filters.length,
      separatorBuilder: (_, _) => const SizedBox(width: NbSpace.sm),
      itemBuilder: (_, index) {
        final (filter, label, icon) = _filters[index];
        return FilterPill(
          label: label,
          icon: icon,
          selected: selected == filter,
          onPressed: () =>
              ref.read(statementQueryProvider.notifier).toggle(filter),
        );
      },
    ),
  );
}

class _Content extends ConsumerWidget {
  const new({
    required this.header,
    required this.statement,
    required this.filtered,
    required this.onItem,
  });

  final List<Widget> header;
  final AsyncValue<StatementView> statement;
  final bool filtered;
  final ValueChanged<String> onItem;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final now = ref.watch(nowProvider)();
    final body = switch (statement) {
      AsyncValue(value: final view?) when view.items.isEmpty => <Widget>[
        if (filtered)
          const EmptyState(
            icon: Icons.search_off,
            title: 'Nada encontrado',
            message: 'Tente outro filtro ou outro nome.',
          )
        else
          const EmptyState(
            icon: Icons.receipt_long_outlined,
            title: 'Sem movimentações',
            message: 'Seus Pix enviados e recebidos aparecem aqui.',
          ),
      ],
      AsyncValue(value: final view?) => [
        for (final item in view.items)
          _Movement(item: item, now: now, onTap: () => onItem(item.id)),
        _Footer(view: view),
      ],
      AsyncError() => [
        ErrorState(
          retryLabel: CommonCopy.retry,
          message: 'Não foi possível carregar o extrato.',
          onRetry: () => ref.invalidate(filteredStatementProvider),
        ),
      ],
      _ => [
        Semantics(
          label: 'Carregando o extrato',
          container: true,
          child: Column(
            children: [
              for (var i = 0; i < 4; i++) ...[
                const Skeleton(width: double.infinity, height: 52),
                const SizedBox(height: NbSpace.lg),
              ],
            ],
          ),
        ),
      ],
    };
    final children = [...header, ...body];
    return ListView.builder(
      // Pull to refresh works even when the page does not fill the screen.
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(
        NbSpace.screen,
        0,
        NbSpace.screen,
        NbSpace.screen,
      ),
      itemCount: children.length,
      itemBuilder: (_, index) => children[index],
    );
  }
}

class _Movement extends StatelessWidget {
  const new({required this.item, required this.now, required this.onTap});

  final StatementItem item;
  final DateTime now;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => TransactionItem(
    title: statementTitle(item.kind),
    caption: statementCaption(item, now),
    amountCents: item.amountCents,
    incoming: item.direction == MoneyDirection.incoming,
    onTap: onTap,
  );
}

/// The end of the list: the next page loading, why it failed, or the end.
/// The list builds it only when the end is near, so being built is what asks
/// the next page, also when the first page fits the screen and never scrolls.
class _Footer extends ConsumerWidget {
  const new({required this.view});

  final StatementView view;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final error = view.loadMoreError;
    if (view.hasMore && !view.loadingMore && error == null) {
      // After the frame: a page is never asked in the middle of a build.
      WidgetsBinding.instance.addPostFrameCallback(
        (_) =>
            unawaited(ref.read(filteredStatementProvider.notifier).loadMore()),
      );
    }
    final child = switch (view) {
      StatementView(loadingMore: true) => const CircularProgressIndicator(
        semanticsLabel: 'Carregando mais movimentações',
      ),
      _ when error != null => ErrorState(
        retryLabel: CommonCopy.retry,
        message: error,
        onRetry: () =>
            unawaited(ref.read(filteredStatementProvider.notifier).loadMore()),
      ),
      StatementView(hasMore: false) => Text(
        'Não há movimentações mais antigas.',
        style: Theme.of(context).textTheme.bodySmall,
      ),
      _ => const SizedBox.shrink(),
    };
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: NbSpace.xl),
      child: Center(child: child),
    );
  }
}
