import 'package:design_system/src/text_styles.dart';
import 'package:design_system/src/theme.dart';
import 'package:design_system/src/tokens.dart';
import 'package:flutter/material.dart';

/// How a [NbTag] stands out.
enum NbTagTone {
  /// The label on the primary color: news, such as "Novo".
  filled,

  /// An accent border and label: a suggestion, such as "Recomendada".
  outlined,
}

/// A short label beside a title (v1.1.0 plan, task 4.17).
class NbTag extends StatelessWidget {
  /// Shows [label] as a tag of [tone].
  const new({required this.label, this.tone = NbTagTone.filled, super.key});

  /// The text, a word or two.
  final String label;

  /// How the tag stands out.
  final NbTagTone tone;

  // Tight on purpose: the tag sits on a title's line without making it taller.
  static const double _verticalPadding = 2;

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;
    final filled = tone == NbTagTone.filled;

    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: NbSpace.sm,
        vertical: _verticalPadding,
      ),
      decoration: BoxDecoration(
        color: filled ? colors.primary : null,
        border: filled ? null : Border.all(color: colors.accent),
        borderRadius: BorderRadius.circular(NbRadius.tag),
      ),
      child: Text(
        label,
        style: context.nbText.cardLabel.copyWith(
          color: filled ? colors.onPrimary : colors.accent,
        ),
      ),
    );
  }
}
