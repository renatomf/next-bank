import 'package:design_system/src/theme/theme.dart';
import 'package:design_system/src/tokens/tokens.dart';
import 'package:flutter/material.dart';

/// Nothing to show yet, said plainly (brief, section 7): an icon, a title and
/// what will appear here.
class EmptyState extends StatelessWidget {
  /// Creates the empty state.
  const new({
    required this.icon,
    required this.title,
    required this.message,
    super.key,
  });

  /// What would be here.
  final IconData icon;

  /// The short news, e.g. "Sem movimentações".
  final String title;

  /// What will appear and when.
  final String message;

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: NbSpace.xl),
      child: Column(
        children: [
          ExcludeSemantics(
            child: Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                color: colors.surface2,
                shape: BoxShape.circle,
              ),
              child: Icon(icon, size: 26, color: colors.textMuted),
            ),
          ),
          const SizedBox(height: NbSpace.md),
          Text(
            title,
            textAlign: TextAlign.center,
            style: NbType.bodyStrong.copyWith(color: colors.text),
          ),
          const SizedBox(height: NbSpace.xs),
          Text(
            message,
            textAlign: TextAlign.center,
            style: NbType.caption.copyWith(color: colors.textMuted),
          ),
        ],
      ),
    );
  }
}
