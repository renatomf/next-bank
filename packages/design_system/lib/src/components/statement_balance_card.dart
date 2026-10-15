import 'package:design_system/src/components/balance_amount.dart';
import 'package:design_system/src/components/glass_art.dart';
import 'package:design_system/src/components/glass_panel.dart';
import 'package:design_system/src/tokens.dart';
import 'package:flutter/material.dart';

/// One action at the foot of [StatementBalanceCard].
typedef StatementCardAction = ({
  IconData icon,
  String label,
  VoidCallback onPressed,
});

/// The balance on top of the statement (v1.1.0 plan, task 4.1): the same
/// green glass art and deep tint as the Home's card, the balance centered on
/// the same frosted glass panel, and a row of actions below, split by thin
/// lines.
class StatementBalanceCard extends StatelessWidget {
  /// Creates the card; a null [accountNumber] or [balanceCents] means it is
  /// still loading.
  const new({
    required this.accountNumber,
    required this.balanceCents,
    required this.hidden,
    required this.actions,
    super.key,
  });

  /// The account number, e.g. "100000-4"; only its last four digits show.
  final String? accountNumber;

  /// The available balance in integer cents.
  final int? balanceCents;

  /// True while the customer chose to hide the balance (MOB-05).
  final bool hidden;

  /// The actions at the foot, left to right.
  final List<StatementCardAction> actions;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(NbRadius.card),
        border: Border.all(color: NbBalanceCardColors.border),
        boxShadow: const [
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
        child: Stack(
          children: [
            const Positioned.fill(child: GlassArt()),
            // Deep on top and at the foot, lighter in between, so the art
            // shows while every text keeps AA, as on the Home's card.
            const Positioned.fill(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      NbBalanceCardColors.tintDeep,
                      NbBalanceCardColors.tintLight,
                      NbBalanceCardColors.tintDeep,
                    ],
                    stops: [0, 0.5, 1],
                  ),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(
                NbSpace.screen,
                NbSpace.xl,
                NbSpace.screen,
                NbSpace.lg,
              ),
              child: Column(
                children: [
                  GlassPanel(
                    child: BalanceAmount(
                      accountNumber: accountNumber,
                      cents: balanceCents,
                      hidden: hidden,
                    ),
                  ),
                  const SizedBox(height: NbSpace.xl),
                  IntrinsicHeight(
                    child: Row(
                      children: [
                        for (final (index, action) in actions.indexed) ...[
                          if (index > 0)
                            const VerticalDivider(
                              width: 1,
                              thickness: 1,
                              indent: NbSpace.sm,
                              endIndent: NbSpace.sm,
                              color: NbBalanceCardColors.buttonBorder,
                            ),
                          Expanded(child: _Action(action: action)),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Action extends StatelessWidget {
  const new({required this.action});

  final StatementCardAction action;

  @override
  Widget build(BuildContext context) => Semantics(
    container: true,
    button: true,
    label: action.label,
    excludeSemantics: true,
    child: InkWell(
      onTap: action.onPressed,
      borderRadius: BorderRadius.circular(NbRadius.block),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: NbSpace.sm),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(action.icon, size: 22, color: NbBalanceCardColors.text),
            const SizedBox(height: NbSpace.xs),
            FittedBox(
              fit: BoxFit.scaleDown,
              child: Text(
                action.label,
                maxLines: 1,
                style: NbType.caption.copyWith(color: NbBalanceCardColors.text),
              ),
            ),
          ],
        ),
      ),
    ),
  );
}
