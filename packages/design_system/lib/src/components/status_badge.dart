import 'package:design_system/src/theme/theme.dart';
import 'package:design_system/src/tokens/tokens.dart';
import 'package:flutter/material.dart';

/// How a status reads.
enum StatusTone {
  /// Done: a check in the success color.
  success,

  /// Failed: a cross in the danger color.
  danger,

  /// Still running: a clock in the muted color.
  pending,
}

/// A status pill (brief, section 7; comprovante-dark mockup): an icon and a
/// word, so it never depends on color alone (brief, section 8).
class StatusBadge extends StatelessWidget {
  /// Creates the badge.
  const new({required this.tone, required this.label, super.key});

  /// How the status reads.
  final StatusTone tone;

  /// The status in words, e.g. "Concluído".
  final String label;

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;
    final (color, icon) = switch (tone) {
      StatusTone.success => (colors.success, Icons.check),
      StatusTone.danger => (colors.danger, Icons.close),
      StatusTone.pending => (colors.textMuted, Icons.schedule),
    };
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: NbSpace.md,
        vertical: NbSpace.xs + 2,
      ),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(NbRadius.pill),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          ExcludeSemantics(child: Icon(icon, size: 16, color: color)),
          const SizedBox(width: NbSpace.xs + 2),
          Text(
            label,
            style: NbType.caption.copyWith(
              color: color,
              fontWeight: FontWeight.w700,
              fontVariations: const [FontVariation.weight(700)],
            ),
          ),
        ],
      ),
    );
  }
}
