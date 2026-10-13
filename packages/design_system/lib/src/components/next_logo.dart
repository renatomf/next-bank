import 'package:design_system/src/theme.dart';
import 'package:design_system/src/tokens.dart';
import 'package:flutter/material.dart';

/// The "next" wordmark followed by a mint dot (brief, section 6). The dot
/// sits on the text's baseline, close to the "t", without a glow: the
/// developer's choice over the mockup, where it was centered and glowing.
class NextLogo extends StatelessWidget {
  /// Creates the logo at [size] (the wordmark's font size).
  const new({this.size = 36, this.color, this.word = 'next', super.key});

  /// Font size of the wordmark.
  final double size;

  /// Wordmark color; defaults to the theme's text. The balance card, always
  /// dark, sets its own.
  final Color? color;

  /// The word before the dot: "next" everywhere, "n" in the app icon (week 8
  /// plan, task 4).
  final String word;

  @override
  Widget build(BuildContext context) {
    final dot = size * 0.2;
    // 2 px down and 2 px right at the default size 36, in proportion at any
    // other size.
    final nudge = size * 2 / 36;
    return Semantics(
      container: true,
      label: 'next bank',
      excludeSemantics: true,
      child: Text.rich(
        TextSpan(
          text: word,
          children: [
            // A box has no baseline of its own, so its bottom rests on the
            // text's baseline, like a period.
            WidgetSpan(
              alignment: PlaceholderAlignment.baseline,
              baseline: TextBaseline.alphabetic,
              child: Transform.translate(
                offset: Offset(0, nudge),
                child: Container(
                  width: dot,
                  height: dot,
                  margin: EdgeInsets.only(left: size * 0.06 + nudge),
                  decoration: const BoxDecoration(
                    color: NbBrand.mint,
                    shape: BoxShape.circle,
                  ),
                ),
              ),
            ),
          ],
        ),
        style: TextStyle(
          fontFamily: NbType.display,
          package: 'design_system',
          fontSize: size,
          fontWeight: FontWeight.w700,
          fontVariations: const [FontVariation.weight(700)],
          letterSpacing: -0.04 * size,
          color: color ?? context.nbColors.text,
        ),
      ),
    );
  }
}
