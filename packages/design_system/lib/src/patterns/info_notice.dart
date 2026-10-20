import 'package:design_system/src/theme/theme.dart';
import 'package:design_system/src/tokens/tokens.dart';
import 'package:flutter/material.dart';

/// A visible notice with an icon and text (status never by color alone),
/// such as the public demo warning (DEMO-01) or why the session ended.
class InfoNotice extends StatelessWidget {
  /// Creates the notice with its [message].
  const new({required this.message, super.key});

  /// What the user must know.
  final String message;

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;
    return Container(
      padding: const EdgeInsets.all(NbSpace.md),
      decoration: BoxDecoration(
        color: colors.surface2,
        borderRadius: BorderRadius.circular(NbRadius.field),
        border: Border.all(color: colors.border),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.info_outline, size: 20, color: colors.accent),
          const SizedBox(width: NbSpace.sm),
          Expanded(
            child: Text(
              message,
              style: NbType.caption.copyWith(color: colors.text),
            ),
          ),
        ],
      ),
    );
  }
}
