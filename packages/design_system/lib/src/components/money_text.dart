import 'package:design_system/src/theme.dart';
import 'package:design_system/src/tokens.dart';
import 'package:flutter/material.dart';

/// An amount in reais split for display: "10.000" and ",00", and the whole
/// "R$ 10.000,00" for screen readers.
typedef ReaisParts = ({String integer, String cents, String full});

/// Formats integer [cents] as reais (ADR 0006: formatting happens only in the
/// design system). Balances are never negative, so neither is this.
ReaisParts formatReais(int cents) {
  if (cents < 0) {
    throw ArgumentError.value(cents, 'cents', 'must not be negative');
  }
  final digits = (cents ~/ 100).toString();
  final integer = digits.replaceAllMapped(
    RegExp(r'\B(?=(\d{3})+$)'),
    (_) => '.',
  );
  final decimals = ',${(cents % 100).toString().padLeft(2, '0')}';
  return (integer: integer, cents: decimals, full: 'R\$ $integer$decimals');
}

/// A large amount of money (brief, section 3): "R$" and the cents smaller and
/// muted beside the integer. While [hidden], no digit is shown or read
/// (MOB-05).
class MoneyText extends StatelessWidget {
  /// Creates the amount; [color] and [mutedColor] default to the theme's.
  const new({
    required this.cents,
    this.hidden = false,
    this.color,
    this.mutedColor,
    super.key,
  });

  /// The amount, in integer cents.
  final int cents;

  /// True to hide the amount from people beside the customer.
  final bool hidden;

  /// Color of the integer part.
  final Color? color;

  /// Color of "R$" and the cents.
  final Color? mutedColor;

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;
    final main = NbType.moneyLarge.copyWith(color: color ?? colors.text);
    final part = NbType.moneyLargePart.copyWith(
      color: mutedColor ?? colors.textMuted,
    );
    final parts = hidden ? null : formatReais(cents);
    // Its own node: inside a list or a card it must not merge with siblings.
    return Semantics(
      container: true,
      label: parts?.full ?? 'Saldo oculto',
      excludeSemantics: true,
      child: RichText(
        textScaler: MediaQuery.textScalerOf(context),
        text: TextSpan(
          children: [
            TextSpan(text: r'R$ ', style: part),
            TextSpan(text: parts?.integer ?? '••••••', style: main),
            TextSpan(text: parts?.cents ?? '', style: part),
          ],
        ),
      ),
    );
  }
}
