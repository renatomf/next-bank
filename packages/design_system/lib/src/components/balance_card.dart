import 'dart:ui';

import 'package:design_system/src/components/icon_circle_button.dart';
import 'package:design_system/src/components/money_text.dart';
import 'package:design_system/src/components/skeleton.dart';
import 'package:design_system/src/tokens.dart';
import 'package:flutter/material.dart';

/// The Home's signature card (brief, section 2.3; v1.1.0 checkpoint,
/// 2026-10-14): always dark, the green glass art under a dark tint, the
/// account on a glass chip, and the available balance on a glass panel with
/// its tab, with an eye to hide it (MOB-05). Null values mean the balance
/// is still loading.
class BalanceCard extends StatelessWidget {
  /// Creates the card.
  const new({
    required this.accountNumber,
    required this.balanceCents,
    required this.hidden,
    required this.onToggleHidden,
    super.key,
  });

  /// Minimum height of the card; larger text grows it.
  static const double height = 220;

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
              const Positioned.fill(
                child: Image(
                  image: NbArt.glass,
                  fit: BoxFit.cover,
                  excludeFromSemantics: true,
                ),
              ),
              const Positioned.fill(
                child: ColoredBox(color: NbBalanceCardColors.tint),
              ),
              Positioned(
                top: NbSpace.lg,
                left: NbSpace.lg,
                right: NbSpace.lg,
                child: Row(
                  children: [
                    Flexible(
                      child: _Glass(
                        borderRadius: BorderRadius.circular(NbRadius.pill),
                        padding: const EdgeInsets.symmetric(
                          horizontal: NbSpace.md,
                          vertical: 6,
                        ),
                        child: number == null
                            ? const Skeleton(
                                width: 96,
                                height: 12,
                                color: NbBalanceCardColors.placeholder,
                              )
                            : Text(
                                'Conta ${_masked(number)}',
                                overflow: TextOverflow.ellipsis,
                                style: NbType.cardLabel.copyWith(
                                  color: NbBalanceCardColors.text,
                                ),
                              ),
                      ),
                    ),
                    const SizedBox(width: NbSpace.sm),
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
              // The top padding keeps the panel clear of the chip row as
              // text grows; the art shows in between.
              Padding(
                padding: const EdgeInsets.fromLTRB(12, 88, 12, 12),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const _Tab(),
                    _Glass(
                      borderRadius: BorderRadius.circular(NbRadius.block),
                      padding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 14,
                      ),
                      fullWidth: true,
                      child: cents == null
                          ? const _LoadingBalance()
                          : _Balance(cents: cents, hidden: hidden),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// Only the last four digits: "•••• 0004".
  static String _masked(String number) {
    final digits = number.replaceAll(RegExp(r'\D'), '');
    return '•••• ${digits.substring(digits.length - 4)}';
  }
}

/// "Saldo disponível", a tab on top of the balance panel.
class _Tab extends StatelessWidget {
  const new();

  @override
  Widget build(BuildContext context) {
    // Its own node, so a list never merges it with the rest.
    return Semantics(
      container: true,
      header: true,
      child: _Glass(
        borderRadius: const BorderRadius.vertical(
          top: Radius.circular(NbRadius.field),
        ),
        padding: const EdgeInsets.fromLTRB(
          NbSpace.lg,
          NbSpace.sm,
          NbSpace.lg,
          NbSpace.xs,
        ),
        openBottom: true,
        child: Text(
          'Saldo disponível',
          style: NbType.cardLabel.copyWith(color: NbBalanceCardColors.text),
        ),
      ),
    );
  }
}

class _Balance extends StatelessWidget {
  const new({required this.cents, required this.hidden});

  final int cents;
  final bool hidden;

  @override
  Widget build(BuildContext context) {
    // A large balance shrinks to fit instead of breaking the line.
    return FittedBox(
      fit: BoxFit.scaleDown,
      alignment: Alignment.centerLeft,
      child: MoneyText(
        cents: cents,
        hidden: hidden,
        color: NbBalanceCardColors.text,
        mutedColor: NbBalanceCardColors.textMuted,
      ),
    );
  }
}

class _LoadingBalance extends StatelessWidget {
  const new();

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'Carregando saldo',
      container: true,
      child: const Align(
        alignment: Alignment.centerLeft,
        child: Skeleton(
          width: 200,
          height: 34,
          color: NbBalanceCardColors.placeholder,
        ),
      ),
    );
  }
}

/// Glass over the art: blurred and darkened, so text stays readable on it.
class _Glass extends StatelessWidget {
  const new({
    required this.borderRadius,
    required this.padding,
    required this.child,
    this.fullWidth = false,
    this.openBottom = false,
  });

  final BorderRadius borderRadius;
  final EdgeInsets padding;
  final Widget child;

  /// True to fill the width, like the balance panel.
  final bool fullWidth;

  /// True to drop the bottom border, so the tab joins the panel below.
  final bool openBottom;

  @override
  Widget build(BuildContext context) {
    const side = BorderSide(color: NbBalanceCardColors.glassBorder);
    return ClipRRect(
      borderRadius: borderRadius,
      child: BackdropFilter(
        // CSS blur(14px) is a standard deviation of 14 px.
        filter: ImageFilter.blur(sigmaX: 14, sigmaY: 14),
        child: Container(
          width: fullWidth ? double.infinity : null,
          padding: padding,
          decoration: BoxDecoration(
            color: NbBalanceCardColors.glass,
            borderRadius: borderRadius,
            border: openBottom
                ? const Border(top: side, left: side, right: side)
                : Border.all(color: NbBalanceCardColors.glassBorder),
          ),
          child: child,
        ),
      ),
    );
  }
}
