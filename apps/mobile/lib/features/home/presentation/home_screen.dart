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
                _Header(firstName: name.split(' ').first),
                const SizedBox(height: 22),
                const _HelpRow(),
                const SizedBox(height: NbSpace.lg),
                _Shortcuts(onPix: onPix),
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

/// The profile icon, as on the navigation bar, the first name and the logo
/// (week 8 plan, V8).
class _Header extends StatelessWidget {
  const new({required this.firstName});

  final String firstName;

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;
    return Row(
      children: [
        // The name is read right after it.
        ExcludeSemantics(
          child: Container(
            width: NbSize.touch,
            height: NbSize.touch,
            decoration: BoxDecoration(
              color: colors.surface2,
              shape: BoxShape.circle,
              border: Border.all(color: colors.border),
            ),
            child: Icon(Icons.person_outline, color: colors.text),
          ),
        ),
        const SizedBox(width: NbSpace.md),
        Expanded(
          child: Text(
            firstName,
            style: NbType.bodyStrong.copyWith(color: colors.text),
            overflow: TextOverflow.ellipsis,
          ),
        ),
        const SizedBox(width: NbSpace.md),
        const NextLogo(size: 24),
      ],
    );
  }
}

/// "Posso te ajudar?": a button shaped like a field, for the assistant that
/// comes after v1.0.0 (week 8 plan, V9). Honest about it: it says so.
class _HelpField extends StatelessWidget {
  const new();

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;
    return Semantics(
      button: true,
      label: 'Posso te ajudar? Assistente, em breve',
      excludeSemantics: true,
      child: Material(
        color: colors.surface,
        shape: StadiumBorder(side: BorderSide(color: colors.border)),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: () => showNbToast(
            context,
            'Em breve: assistente com IA.',
            icon: Icons.info_outline,
          ),
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 48),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: NbSpace.lg),
              child: Row(
                children: [
                  Icon(Icons.auto_awesome, color: colors.accent),
                  const SizedBox(width: NbSpace.md),
                  Expanded(
                    child: Text(
                      'Posso te ajudar?',
                      style: NbType.bodyText.copyWith(color: colors.textMuted),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// The Home's row of four (home-dark mockup): the Pix opens its area; the
/// others come with their screens after v1.0.0 and say so (week 8 plan, V7).
class _Shortcuts extends StatelessWidget {
  const new({required this.onPix});

  final VoidCallback onPix;

  @override
  Widget build(BuildContext context) {
    void soon() => showNbToast(context, 'Em breve.', icon: Icons.info_outline);
    final tiles = [
      ActionTile(icon: const PixMark(), label: 'Área Pix', onPressed: onPix),
      ActionTile(
        icon: const Icon(Icons.qr_code_scanner),
        label: 'Pagar',
        onPressed: soon,
      ),
      ActionTile(
        icon: const Icon(Icons.swap_horiz),
        label: 'Transferir',
        onPressed: soon,
      ),
      ActionTile(
        icon: const Icon(Icons.phone_android),
        label: 'Recarga',
        onPressed: soon,
      ),
    ];
    // One height for the four, the tallest one's (week 8 plan, V13).
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (final (index, tile) in tiles.indexed) ...[
            if (index > 0) const SizedBox(width: NbSpace.sm),
            Expanded(child: tile),
          ],
        ],
      ),
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

/// The help field with the help and notification buttons beside it, both
/// coming after v1.0.0 and saying so (week 8 plan, V11).
class _HelpRow extends StatelessWidget {
  const new();

  @override
  Widget build(BuildContext context) {
    void soon() => showNbToast(context, 'Em breve.', icon: Icons.info_outline);
    return Row(
      children: [
        const Expanded(child: _HelpField()),
        const SizedBox(width: NbSpace.sm),
        IconCircleButton(
          icon: Icons.help_outline,
          label: 'Ajuda',
          onPressed: soon,
        ),
        const SizedBox(width: NbSpace.sm),
        IconCircleButton(
          icon: Icons.notifications_none,
          label: 'Notificações',
          onPressed: soon,
        ),
      ],
    );
  }
}
