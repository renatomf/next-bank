import 'dart:async';

import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:next_bank/core/account/account_providers.dart';
import 'package:next_bank/core/clock.dart';
import 'package:next_bank/core/statement/statement_controller.dart';
import 'package:next_bank/core/statement/statement_item.dart';
import 'package:next_bank/core/statement/statement_texts.dart';

/// The statement (screen 11): newest first, the next page as the customer
/// nears the end, pull to refresh. Amounts hide with the balance (T4-1).
class StatementScreen extends ConsumerWidget {
  /// Creates the screen; the router says where back and a movement go.
  const new({required this.onBack, required this.onItem, super.key});

  /// Leaves the statement.
  final VoidCallback onBack;

  /// Opens the detail of a movement.
  final ValueChanged<String> onItem;

  /// How close to the end, in pixels, the next page is asked.
  static const double loadMoreAhead = 400;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final statement = ref.watch(statementProvider);
    final controller = ref.read(statementProvider.notifier);
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
                  onPressed: onBack,
                ),
              ),
              Expanded(
                child: switch (statement) {
                  AsyncData(value: final view) when view.items.isEmpty =>
                    const _Padded(
                      child: EmptyState(
                        icon: Icons.receipt_long_outlined,
                        title: 'Sem movimentações',
                        message: 'Seus Pix enviados e recebidos aparecem aqui.',
                      ),
                    ),
                  AsyncData(value: final view) => RefreshIndicator(
                    onRefresh: controller.refresh,
                    child: NotificationListener<ScrollNotification>(
                      onNotification: (scroll) {
                        if (scroll.metrics.extentAfter < loadMoreAhead) {
                          unawaited(controller.loadMore());
                        }
                        return false;
                      },
                      child: _List(view: view, onItem: onItem),
                    ),
                  ),
                  AsyncError() => _Padded(
                    child: ErrorState(
                      message: 'Não foi possível carregar o extrato.',
                      onRetry: () => ref.invalidate(statementProvider),
                    ),
                  ),
                  _ => const _Loading(),
                },
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _List extends ConsumerWidget {
  const new({required this.view, required this.onItem});

  final StatementView view;
  final ValueChanged<String> onItem;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final now = ref.watch(nowProvider)();
    final hidden = ref.watch(balanceHiddenProvider);
    final items = view.items;
    return ListView.builder(
      // Pull to refresh works even when the page does not fill the screen.
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.symmetric(horizontal: NbSpace.screen),
      itemCount: items.length + 1,
      itemBuilder: (context, index) => index < items.length
          ? _Movement(
              item: items[index],
              now: now,
              hidden: hidden,
              onTap: () => onItem(items[index].id),
            )
          : _Footer(view: view),
    );
  }
}

class _Movement extends StatelessWidget {
  const new({
    required this.item,
    required this.now,
    required this.hidden,
    required this.onTap,
  });

  final StatementItem item;
  final DateTime now;
  final bool hidden;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => TransactionItem(
    title: statementTitle(item.kind),
    caption: statementCaption(item, now),
    amountCents: item.amountCents,
    incoming: item.direction == MoneyDirection.incoming,
    hidden: hidden,
    onTap: onTap,
  );
}

/// The end of the list: the next page loading, why it failed, or the end.
class _Footer extends ConsumerWidget {
  const new({required this.view});

  final StatementView view;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final error = view.loadMoreError;
    final child = switch (view) {
      StatementView(loadingMore: true) => const CircularProgressIndicator(
        semanticsLabel: 'Carregando mais movimentações',
      ),
      _ when error != null => ErrorState(
        message: error,
        onRetry: () =>
            unawaited(ref.read(statementProvider.notifier).loadMore()),
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

class _Loading extends StatelessWidget {
  const new();

  @override
  Widget build(BuildContext context) => Semantics(
    label: 'Carregando o extrato',
    container: true,
    child: ListView(
      padding: const EdgeInsets.all(NbSpace.screen),
      children: [
        for (var i = 0; i < 6; i++) ...[
          const Skeleton(width: double.infinity, height: 52),
          const SizedBox(height: NbSpace.lg),
        ],
      ],
    ),
  );
}

class _Padded extends StatelessWidget {
  const new({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) => ListView(
    padding: const EdgeInsets.all(NbSpace.screen),
    children: [child],
  );
}
