import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:next_bank/core/account/account_providers.dart';
import 'package:next_bank/core/api_failure.dart';
import 'package:next_bank/core/clock.dart';
import 'package:next_bank/core/profile/profile_controller.dart';
import 'package:next_bank/core/refresh_failure.dart';
import 'package:next_bank/core/statement/statement_controller.dart';
import 'package:next_bank/core/statement/statement_item.dart';
import 'package:next_bank/core/statement/statement_texts.dart';
import 'package:next_bank/features/home/presentation/home_providers.dart';

/// Home (screen 6; mockups home-dark and home-light): the greeting and the
/// available balance, the Pix shortcut and the latest movements. The floating
/// bar and the sign-out on the Profile come from the app (week 7 plan, T3-1).
class HomeScreen extends ConsumerWidget {
  /// Creates the home; the app says where the shortcuts go, so features never
  /// import each other.
  const new({
    required this.onPix,
    required this.onStatement,
    required this.onMovement,
    super.key,
  });

  /// Opens the Pix.
  final VoidCallback onPix;

  /// Opens the statement.
  final VoidCallback onStatement;

  /// Opens the detail of a movement.
  final ValueChanged<String> onMovement;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final name = ref.watch(profileProvider).value?.name ?? '';
    final greeting = greetingFor(ref.watch(nowProvider)());
    toastFailedRefresh(context, ref, accountProvider);
    toastFailedRefresh(context, ref, statementProvider);
    return Scaffold(
      body: GlowBackground(
        child: SafeArea(
          // Pulled down, the Home reads the balance and the movements again,
          // as when money arrives with the app open.
          child: RefreshIndicator(
            onRefresh: () async {
              try {
                await Future.wait([
                  ref.refresh(accountProvider.future),
                  ref.read(statementProvider.notifier).refresh(),
                ]);
              } on ApiFailure {
                // Told by the toast; the screen keeps what it had.
              }
            },
            // Mockup: 28 px on top, 20 on the sides, 22 between sections.
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(20, 28, 20, 20),
              children: [
                _Header(greeting: greeting, name: name),
                const SizedBox(height: 22),
                // The mockup's row of four; the other three shortcuts come with
                // their screens, so the Pix keeps a quarter of the width.
                Row(
                  children: [
                    Expanded(
                      child: ActionTile(
                        icon: Icons.swap_horiz,
                        label: 'Área Pix',
                        onPressed: onPix,
                      ),
                    ),
                    const Spacer(flex: 3),
                  ],
                ),
                const SizedBox(height: 22),
                const _Balance(),
                const SizedBox(height: 22),
                _LatestMovements(
                  onStatement: onStatement,
                  onMovement: onMovement,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const new({required this.greeting, required this.name});

  final String greeting;
  final String name;

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;
    return Row(
      children: [
        // The initial repeats the name, which is read right after it.
        ExcludeSemantics(
          child: Container(
            width: NbSize.touch,
            height: NbSize.touch,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: colors.surface2,
              shape: BoxShape.circle,
              border: Border.all(color: colors.border),
            ),
            child: Text(
              name.isEmpty ? '' : name.characters.first.toUpperCase(),
              style: NbType.avatar.copyWith(color: colors.text),
            ),
          ),
        ),
        const SizedBox(width: NbSpace.md),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                greeting,
                style: NbType.captionPlain.copyWith(color: colors.textMuted),
              ),
              const SizedBox(height: 2),
              Text(
                name,
                style: NbType.bodyStrong.copyWith(color: colors.text),
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
        const SizedBox(width: NbSpace.md),
        const NextLogo(size: 24),
      ],
    );
  }
}

class _Balance extends ConsumerWidget {
  const new();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final hidden = ref.watch(balanceHiddenProvider);
    void toggle() => ref.read(balanceHiddenProvider.notifier).toggle();
    return switch (ref.watch(accountProvider)) {
      AsyncValue(value: final account?) => BalanceCard(
        accountNumber: account.number,
        balanceCents: account.availableBalanceCents,
        hidden: hidden,
        onToggleHidden: toggle,
      ),
      AsyncError() => Padding(
        padding: const EdgeInsets.symmetric(vertical: NbSpace.xl),
        child: ErrorState(
          message: 'Não foi possível carregar seu saldo.',
          onRetry: () => ref.invalidate(accountProvider),
        ),
      ),
      _ => BalanceCard(
        accountNumber: null,
        balanceCents: null,
        hidden: hidden,
        onToggleHidden: toggle,
      ),
    };
  }
}

/// The latest movements (home-dark mockup): the newest three of the same
/// statement the statement screen shows, and "Ver extrato".
class _LatestMovements extends ConsumerWidget {
  const new({required this.onStatement, required this.onMovement});

  final VoidCallback onStatement;
  final ValueChanged<String> onMovement;

  /// How many movements the Home shows.
  static const int count = 3;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.nbColors;
    final now = ref.watch(nowProvider)();
    final hidden = ref.watch(balanceHiddenProvider);
    final content = switch (ref.watch(statementProvider)) {
      AsyncValue(value: StatementView(items: [])) => const EmptyState(
        icon: Icons.receipt_long_outlined,
        title: 'Sem movimentações',
        message: 'Seus Pix enviados e recebidos aparecem aqui.',
      ),
      AsyncValue(:final value?) => Column(
        children: [
          for (final (index, item) in value.items.take(count).indexed) ...[
            if (index > 0) Divider(height: 1, color: colors.border),
            TransactionItem(
              title: statementTitle(item.kind),
              caption: statementCaption(item, now),
              amountCents: item.amountCents,
              incoming: item.direction == MoneyDirection.incoming,
              hidden: hidden,
              onTap: () => onMovement(item.id),
            ),
          ],
        ],
      ),
      AsyncError() => ErrorState(
        message: 'Não foi possível carregar suas movimentações.',
        onRetry: () => ref.invalidate(statementProvider),
      ),
      _ => Semantics(
        label: 'Carregando movimentações',
        container: true,
        child: const Column(
          children: [
            Skeleton(width: double.infinity, height: 52),
            SizedBox(height: NbSpace.md),
            Skeleton(width: double.infinity, height: 52),
          ],
        ),
      ),
    };
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                'Últimas movimentações',
                style: Theme.of(context).textTheme.titleMedium,
              ),
            ),
            TextButton(
              onPressed: onStatement,
              child: const Text('Ver extrato'),
            ),
          ],
        ),
        const SizedBox(height: NbSpace.md),
        Container(
          padding: const EdgeInsets.symmetric(
            horizontal: NbSpace.lg,
            vertical: NbSpace.xs,
          ),
          decoration: BoxDecoration(
            color: colors.surface,
            borderRadius: BorderRadius.circular(NbRadius.block),
            border: Border.all(color: colors.border),
          ),
          child: content,
        ),
      ],
    );
  }
}
