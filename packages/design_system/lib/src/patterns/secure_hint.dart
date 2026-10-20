import 'package:design_system/src/theme/theme.dart';
import 'package:design_system/src/tokens/tokens.dart';
import 'package:flutter/material.dart';

/// A padlock and a short reassurance under a sensitive action (brief,
/// section 7; pix-dark mockup), such as "Você confirma com seu PIN antes de
/// enviar".
class SecureHint extends StatelessWidget {
  /// Creates the hint.
  const new({required this.text, super.key});

  /// What protects the action.
  final String text;

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        ExcludeSemantics(
          child: Icon(Icons.lock_outline, size: 16, color: colors.textMuted),
        ),
        const SizedBox(width: NbSpace.sm),
        Flexible(
          child: Text(
            text,
            textAlign: TextAlign.center,
            style: NbType.captionPlain.copyWith(color: colors.textMuted),
          ),
        ),
      ],
    );
  }
}
