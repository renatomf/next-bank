import 'package:design_system/src/components/balance_amount.dart';
import 'package:design_system/src/components/glass_art.dart';
import 'package:design_system/src/components/glass_panel.dart';
import 'package:design_system/src/components/icon_circle_button.dart';
import 'package:design_system/src/tokens.dart';
import 'package:flutter/material.dart';

/// One action at the foot of a [BalanceCard].
typedef BalanceCardAction = ({
  IconData icon,
  String label,
  VoidCallback onPressed,
});

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
    this.actions = const [],
    super.key,
  });

  /// Opens the statement from a line below the balance; null leaves the
  /// line out (S21 checkpoint of v1.1.0).
  final VoidCallback? onStatement;

  /// Actions in a row below the balance, as on the statement (v1.1.0 plan,
  /// task 4.1); the Home passes none.
  final List<BalanceCardAction> actions;

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
      child: BalanceAmount(accountNumber: number, cents: cents, hidden: hidden),
    );
    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(NbRadius.box),
        border: Border.all(color: NbGlassColors.border),
        boxShadow: const [
          // CSS 0 18px 50px -12px: a 50 px CSS blur is a 42 px Flutter one.
          BoxShadow(
            color: NbGlassColors.shadow,
            offset: Offset(0, 18),
            blurRadius: 42,
            spreadRadius: -12,
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(NbRadius.box),
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: height),
          child: Stack(
            alignment: Alignment.bottomCenter,
            children: [
              const Positioned.fill(child: GlassArt()),
              // Deep under the title, lighter where the glass panel takes
              // over the contrast, so the art shows in between.
              // With actions at the foot, the tint deepens again under them,
              // so their white text keeps AA without a box of its own.
              Positioned.fill(
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: actions.isEmpty ? _homeTint : _footTint,
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
                          color: NbGlassColors.text,
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
                      background: NbGlassColors.button,
                      foreground: NbGlassColors.text,
                      borderColor: NbGlassColors.buttonBorder,
                      iconSize: 18,
                    ),
                  ],
                ),
              ),
              // The panel sits 12 px from the bottom and sides; the top
              // padding keeps it clear of the logo row as text grows.
              Padding(
                padding: const EdgeInsets.fromLTRB(12, 76, 12, 12),
                child: onStatement == null && actions.isEmpty
                    ? panel
                    : Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          panel,
                          if (onStatement case final onStatement?)
                            _StatementLink(onPressed: onStatement),
                          if (actions.isNotEmpty) ...[
                            const SizedBox(height: NbSpace.sm),
                            _Actions(actions: actions),
                          ],
                        ],
                      ),
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
      borderRadius: BorderRadius.circular(NbRadius.boxInner),
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
              style: NbType.bodyText.copyWith(color: NbGlassColors.text),
            ),
            const Icon(Icons.chevron_right, color: NbGlassColors.text),
          ],
        ),
      ),
    ),
  );
}

/// The Home's tint: deep under the title, lighter where the glass panel takes
/// over the contrast.
const LinearGradient _homeTint = LinearGradient(
  begin: Alignment.topCenter,
  end: Alignment.bottomCenter,
  colors: [
    NbGlassColors.tintDeep,
    NbGlassColors.tintDeep,
    NbGlassColors.tintLight,
  ],
  stops: [0, 0.3, 0.6],
);

/// The same tint, deep again at the foot, under the actions.
const LinearGradient _footTint = LinearGradient(
  begin: Alignment.topCenter,
  end: Alignment.bottomCenter,
  colors: [
    NbGlassColors.tintDeep,
    NbGlassColors.tintDeep,
    NbGlassColors.tintLight,
    NbGlassColors.tintDeep,
  ],
  stops: [0, 0.3, 0.55, 0.8],
);

/// The actions in a row, split by thin lines.
class _Actions extends StatelessWidget {
  const new({required this.actions});

  final List<BalanceCardAction> actions;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: NbSpace.xs),
    child: IntrinsicHeight(
      child: Row(
        children: [
          for (final (index, action) in actions.indexed) ...[
            if (index > 0)
              const VerticalDivider(
                width: 1,
                thickness: 1,
                indent: NbSpace.sm,
                endIndent: NbSpace.sm,
                color: NbGlassColors.buttonBorder,
              ),
            Expanded(child: _Action(action: action)),
          ],
        ],
      ),
    ),
  );
}

class _Action extends StatelessWidget {
  const new({required this.action});

  final BalanceCardAction action;

  @override
  Widget build(BuildContext context) => Semantics(
    container: true,
    button: true,
    label: action.label,
    excludeSemantics: true,
    child: InkWell(
      onTap: action.onPressed,
      borderRadius: BorderRadius.circular(NbRadius.boxInner),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: NbSpace.sm),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(action.icon, size: 22, color: NbGlassColors.text),
            const SizedBox(height: NbSpace.xs),
            FittedBox(
              fit: BoxFit.scaleDown,
              child: Text(
                action.label,
                maxLines: 1,
                style: NbType.caption.copyWith(color: NbGlassColors.text),
              ),
            ),
          ],
        ),
      ),
    ),
  );
}
