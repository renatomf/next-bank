import 'package:design_system/src/components/glass_art.dart';
import 'package:design_system/src/components/glass_panel.dart';
import 'package:design_system/src/components/icon_circle_button.dart';
import 'package:design_system/src/components/money_text.dart';
import 'package:design_system/src/components/skeleton.dart';
import 'package:design_system/src/tokens.dart';
import 'package:flutter/material.dart';

/// The Home's signature card (brief, section 2.3; mockups home-dark and
/// home-light, whose CSS gives the layout): always dark, the mint glass art
/// under a dark tint (v1.1.0 checkpoint, 2026-10-14), and the available
/// balance on a glass panel, with an eye to hide it (MOB-05). Null values
/// mean the balance is still loading.
class BalanceCard extends StatelessWidget {
  /// Creates the card.
  const new({
    required this.accountNumber,
    required this.balanceCents,
    required this.hidden,
    required this.onToggleHidden,
    this.onStatement,
    super.key,
  });

  /// Opens the statement from a line below the balance; null leaves the
  /// line out (S21 checkpoint of v1.1.0).
  final VoidCallback? onStatement;

  /// Height of the card in the mockup; larger text grows it.
  static const double height = 190;

  /// The account number, e.g. "100000-4"; only its last four digits show.
  final String? accountNumber;

  /// The available balance in integer cents.
  final int? balanceCents;

  /// True while the customer chose to hide the balance.
  final bool hidden;

  /// Asks the screen to hide or show the balance.
  final VoidCallback onToggleHidden;

  @override
  Widget build(BuildContext context) {
    final number = accountNumber;
    final cents = balanceCents;
    final panel = GlassPanel(
      child: number == null || cents == null
          ? const _LoadingBalance()
          : _Balance(accountNumber: number, cents: cents, hidden: hidden),
    );
    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(NbRadius.card),
        border: Border.all(color: NbBalanceCardColors.border),
        boxShadow: const [
          // CSS 0 18px 50px -12px: a 50 px CSS blur is a 42 px Flutter one.
          BoxShadow(
            color: NbBalanceCardColors.shadow,
            offset: Offset(0, 18),
            blurRadius: 42,
            spreadRadius: -12,
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(NbRadius.card),
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: height),
          child: Stack(
            alignment: Alignment.bottomCenter,
            children: [
              const Positioned.fill(child: GlassArt()),
              // Deep under the title, lighter where the glass panel takes
              // over the contrast, so the art shows in between.
              const Positioned.fill(
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [
                        NbBalanceCardColors.tintDeep,
                        NbBalanceCardColors.tintDeep,
                        NbBalanceCardColors.tintLight,
                      ],
                      stops: [0, 0.3, 0.6],
                    ),
                  ),
                ),
              ),
              Positioned(
                top: NbSpace.screen,
                left: NbSpace.screen,
                right: NbSpace.screen,
                child: Row(
                  children: [
                    // The word, not the logo: the Home already shows it (week 8
                    // plan, V12).
                    // Its own node, so a list never merges it with the rest.
                    Semantics(
                      container: true,
                      header: true,
                      child: Text(
                        'Saldo',
                        style: NbType.sectionTitle.copyWith(
                          color: NbBalanceCardColors.text,
                        ),
                      ),
                    ),
                    const Spacer(),
                    IconCircleButton(
                      icon: hidden
                          ? Icons.visibility_off_outlined
                          : Icons.visibility_outlined,
                      label: hidden ? 'Mostrar saldo' : 'Ocultar saldo',
                      onPressed: onToggleHidden,
                      background: NbBalanceCardColors.button,
                      foreground: NbBalanceCardColors.text,
                      borderColor: NbBalanceCardColors.buttonBorder,
                      iconSize: 18,
                    ),
                  ],
                ),
              ),
              // The panel sits 12 px from the bottom and sides; the top
              // padding keeps it clear of the logo row as text grows.
              Padding(
                padding: const EdgeInsets.fromLTRB(12, 76, 12, 12),
                child: switch (onStatement) {
                  null => panel,
                  final onStatement => Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      panel,
                      _StatementLink(onPressed: onStatement),
                    ],
                  ),
                },
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// "Extrato" and a caret, justified apart in white, read as "Ver extrato".
class _StatementLink extends StatelessWidget {
  const new({required this.onPressed});

  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) => Semantics(
    container: true,
    button: true,
    label: 'Ver extrato',
    excludeSemantics: true,
    child: InkWell(
      onTap: onPressed,
      borderRadius: BorderRadius.circular(NbRadius.block),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(
          NbSpace.md,
          NbSpace.md,
          NbSpace.xs,
          NbSpace.xs,
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'Extrato',
              style: NbType.bodyText.copyWith(color: NbBalanceCardColors.text),
            ),
            const Icon(Icons.chevron_right, color: NbBalanceCardColors.text),
          ],
        ),
      ),
    ),
  );
}

class _Balance extends StatelessWidget {
  const new({
    required this.accountNumber,
    required this.cents,
    required this.hidden,
  });

  final String accountNumber;
  final int cents;
  final bool hidden;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Saldo disponível · Conta ${_masked(accountNumber)}',
          style: NbType.cardLabel.copyWith(
            color: NbBalanceCardColors.textMuted,
          ),
        ),
        const SizedBox(height: NbSpace.xs),
        // A large balance shrinks to fit instead of breaking the line.
        FittedBox(
          fit: BoxFit.scaleDown,
          alignment: Alignment.centerLeft,
          child: MoneyText(
            cents: cents,
            hidden: hidden,
            color: NbBalanceCardColors.text,
            mutedColor: NbBalanceCardColors.textMuted,
          ),
        ),
      ],
    );
  }

  /// Only the last four digits, as in the mockups: "•••• 0004".
  static String _masked(String number) {
    final digits = number.replaceAll(RegExp(r'\D'), '');
    return '•••• ${digits.substring(digits.length - 4)}';
  }
}

class _LoadingBalance extends StatelessWidget {
  const new();

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'Carregando saldo',
      container: true,
      child: const Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Skeleton(
            width: 180,
            height: 12,
            color: NbBalanceCardColors.placeholder,
          ),
          SizedBox(height: NbSpace.md),
          Skeleton(
            width: 200,
            height: 34,
            color: NbBalanceCardColors.placeholder,
          ),
        ],
      ),
    );
  }
}

/// The glass panel that keeps the balance readable over the lights.
