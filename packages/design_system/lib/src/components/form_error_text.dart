import 'package:design_system/src/theme/theme.dart';
import 'package:flutter/material.dart';

/// Why a form could not be sent, as text (status never by color alone) and
/// announced by screen readers as soon as it appears.
class FormErrorText extends StatelessWidget {
  /// Creates the error line with its [message].
  const new(this.message, {super.key});

  /// What went wrong and, when possible, what to do.
  final String message;

  @override
  Widget build(BuildContext context) {
    // Its own node: the announcement carries only the error.
    return Semantics(
      container: true,
      liveRegion: true,
      child: Text(
        message,
        style: Theme.of(context).textTheme.bodySmall
            ?.copyWith(color: context.nbColors.danger),
      ),
    );
  }
}
