import 'dart:ui';

import 'package:design_system/src/components/dither.dart';
import 'package:design_system/src/components/icon_circle_button.dart';
import 'package:design_system/src/components/money_text.dart';
import 'package:design_system/src/components/next_logo.dart';
import 'package:design_system/src/components/skeleton.dart';
import 'package:design_system/src/css_gradients.dart';
import 'package:design_system/src/tokens.dart';
import 'package:flutter/material.dart';

/// The Home's signature card (brief, section 2.3; mockups home-dark and
/// home-light, whose CSS gives every value here): always dark, a silk of mint
/// lights, and the available balance on a glass panel, with an eye to hide
/// it (MOB-05). Null values mean the balance is still loading.
class BalanceCard extends StatelessWidget {
  /// Creates the card.
  const new({
    required this.accountNumber,
    required this.balanceCents,
    required this.hidden,
    required this.onToggleHidden,
    super.key,
  });

  /// Height of the card in the mockup; larger text grows it.
  static const double height = 214;

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
              const Positioned.fill(child: _Silk()),
              const Positioned.fill(child: Dither()),
              Positioned(
                top: NbSpace.screen,
                left: NbSpace.screen,
                right: NbSpace.screen,
                child: Row(
                  children: [
                    const NextLogo(size: 20, color: NbBalanceCardColors.text),
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
                child: _GlassPanel(
                  child: number == null || cents == null
                      ? const _LoadingBalance()
                      : _Balance(
                          accountNumber: number,
                          cents: cents,
                          hidden: hidden,
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
class _GlassPanel extends StatelessWidget {
  const new({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final shape = BorderRadius.circular(NbRadius.block);
    return ClipRRect(
      borderRadius: shape,
      child: BackdropFilter(
        // CSS blur(14px) is a standard deviation of 14 px.
        filter: ImageFilter.blur(sigmaX: 14, sigmaY: 14),
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          decoration: BoxDecoration(
            color: NbBalanceCardColors.glass,
            borderRadius: shape,
            border: Border.all(color: NbBalanceCardColors.glassBorder),
          ),
          child: child,
        ),
      ),
    );
  }
}

/// The silk: the mockup's four CSS backgrounds, drawn with CSS geometry,
/// from the bottom layer up.
class _Silk extends StatelessWidget {
  const new();

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final size = constraints.biggest;
        Widget layer(Gradient gradient) =>
            DecoratedBox(decoration: BoxDecoration(gradient: gradient));
        return Stack(
          fit: StackFit.expand,
          children: [
            // linear-gradient(160deg, #0B2A26 0%, #06110F 70%)
            layer(
              cssLinearGradient(
                size: size,
                angleDegrees: 160,
                colors: const [
                  NbBalanceCardColors.baseTop,
                  NbBalanceCardColors.baseBottom,
                ],
                stops: const [0, 0.7],
              ),
            ),
            // linear-gradient(118deg, clear 38%, sheen 48%, clear 58%)
            layer(
              cssLinearGradient(
                size: size,
                angleDegrees: 118,
                colors: [
                  NbBalanceCardColors.sheen.withValues(alpha: 0),
                  NbBalanceCardColors.sheen,
                  NbBalanceCardColors.sheen.withValues(alpha: 0),
                ],
                stops: const [0.38, 0.48, 0.58],
              ),
            ),
            // radial-gradient(60% 80% at 8% 105%, teal 65% → clear at 65%)
            layer(
              cssRadialGradient(
                size: size,
                center: const Offset(0.08, 1.05),
                radii: const Size(0.6, 0.8),
                colors: [
                  NbBalanceCardColors.glowBottom,
                  NbBalanceCardColors.glowBottom.withValues(alpha: 0),
                ],
                stops: const [0, 0.65],
              ),
            ),
            // radial-gradient(70% 90% at 92% 8%, mint 75% → clear at 60%)
            layer(
              cssRadialGradient(
                size: size,
                center: const Offset(0.92, 0.08),
                radii: const Size(0.7, 0.9),
                colors: [
                  NbBalanceCardColors.glowTop,
                  NbBalanceCardColors.glowTop.withValues(alpha: 0),
                ],
                stops: const [0, 0.6],
              ),
            ),
          ],
        );
      },
    );
  }
}
