import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:next_bank/core/account/account_providers.dart';
import 'package:next_bank/core/api_failure.dart';
import 'package:next_bank/core/profile/profile_controller.dart';
import 'package:next_bank/core/refresh_failure.dart';
import 'package:next_bank/features/home/presentation/widgets/home_pix_box.dart';

/// Home (screen 6; mockups home-dark and home-light): the greeting and the
/// available balance, the Pix shortcut and the latest movements. The floating
/// bar and the sign-out on the Profile come from the app (week 7 plan, T3-1).
class HomeScreen extends ConsumerWidget {
  /// Creates the home; the app says where the shortcuts go, so features never
  /// import each other.
  const new({
    required this.onPix,
    required this.onPay,
    required this.onReceive,
    required this.onStatement,
    required this.onPixWithKey,
    required this.onTransfer,
    required this.onAutomatic,
    required this.onKeys,
    super.key,
  });

  /// Opens the Pix.
  final VoidCallback onPix;

  /// Opens the reading of a Pix QR Code (v1.1.0 plan, task 4).
  final VoidCallback onPay;

  /// Opens "Receber", with the customer's QR Code (v1.1.0 plan, task 3).
  final VoidCallback onReceive;

  /// Opens the statement.
  final VoidCallback onStatement;

  /// Opens the Pix with a CPF key typed in the Pix box, in digits.
  final ValueChanged<String> onPixWithKey;

  /// Opens "Transferir Pix".
  final VoidCallback onTransfer;

  /// Opens "Pix Automático".
  final VoidCallback onAutomatic;

  /// Opens "Minhas chaves".
  final VoidCallback onKeys;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final name = ref.watch(profileProvider).value?.name ?? '';
    toastFailedRefresh(context, ref, accountProvider);
    return Scaffold(
      body: GlowBackground(
        child: SafeArea(
          // Pulled down, the Home reads the balance again, as when money
          // arrives with the app open.
          child: RefreshIndicator(
            onRefresh: () async {
              try {
                ref.invalidate(accountProvider);
                await ref.read(accountProvider.future);
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
                const SizedBox(height: NbSpace.xl),
                _Shortcuts(onPix: onPix, onPay: onPay, onReceive: onReceive),
                const SizedBox(height: 28),
                _Balance(onStatement: onStatement),
                const SizedBox(height: 28),
                // In place of the latest movements (v1.1.0 plan, task 4.2):
                // the statement opens from the balance card.
                HomePixBox(
                  onPix: onPix,
                  onPixWithKey: onPixWithKey,
                  onTransfer: onTransfer,
                  onPay: onPay,
                  onReceive: onReceive,
                  onAutomatic: onAutomatic,
                  onKeys: onKeys,
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

/// The Home's shortcuts (home-dark mockup), scrolling sideways since the
/// S21 checkpoint of v1.1.0: the Pix opens its area, "Pagar" reads a Pix QR
/// Code and "Receber" shows the customer's; the others come with their
/// screens and say so (week 8 plan, V7).
class _Shortcuts extends StatelessWidget {
  const new({
    required this.onPix,
    required this.onPay,
    required this.onReceive,
  });

  final VoidCallback onPix;
  final VoidCallback onPay;
  final VoidCallback onReceive;

  /// Every tile's width: one size for all (week 8 plan, V13).
  static const double _tileWidth = 84;

  @override
  Widget build(BuildContext context) {
    void soon() => showNbToast(context, 'Em breve.', icon: Icons.info_outline);
    final tiles = [
      ActionTile(icon: const PixMark(), label: 'Área Pix', onPressed: onPix),
      ActionTile(
        icon: const Icon(Icons.qr_code_scanner),
        label: 'Pagar',
        onPressed: onPay,
      ),
      ActionTile(
        icon: const Icon(Icons.qr_code_2),
        label: 'Receber',
        onPressed: onReceive,
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
    // A sideways list needs a fixed height: the tile's, grown with the
    // system's text size so larger labels still fit.
    return SizedBox(
      height: MediaQuery.textScalerOf(context).scale(ActionTile.height),
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: tiles.length,
        separatorBuilder: (_, _) => const SizedBox(width: NbSpace.sm),
        itemBuilder: (_, index) =>
            SizedBox(width: _tileWidth, child: tiles[index]),
      ),
    );
  }
}

class _Balance extends ConsumerWidget {
  const new({required this.onStatement});

  final VoidCallback onStatement;

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
        onStatement: onStatement,
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
        onStatement: onStatement,
      ),
    };
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
