import 'package:design_system/src/theme.dart';
import 'package:design_system/src/tokens.dart';
import 'package:flutter/material.dart';

/// The "next" wordmark followed by a glowing Paraíba dot (brief, section 6).
class NextLogo extends StatelessWidget {
  /// Creates the logo at [size] (the wordmark's font size).
  const new({this.size = 36, super.key});

  /// Font size of the wordmark.
  final double size;

  @override
  Widget build(BuildContext context) {
    final dot = size * 0.22;
    return Semantics(
      label: 'next bank',
      excludeSemantics: true,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Text(
            'next',
            style: TextStyle(
              fontFamily: NbType.display,
              package: 'design_system',
              fontSize: size,
              fontWeight: FontWeight.w700,
              fontVariations: const [FontVariation.weight(700)],
              letterSpacing: -0.04 * size,
              color: context.nbColors.text,
            ),
          ),
          Container(
            width: dot,
            height: dot,
            margin: EdgeInsets.only(left: dot * 0.4, bottom: size * 0.2),
            decoration: BoxDecoration(
              color: NbBrand.paraiba,
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: NbBrand.paraiba.withValues(alpha: 0.7),
                  blurRadius: dot * 1.5,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
