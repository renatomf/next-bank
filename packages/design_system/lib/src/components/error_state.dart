import 'package:design_system/src/theme.dart';
import 'package:design_system/src/tokens.dart';
import 'package:flutter/material.dart';

/// What a screen shows when its content could not be loaded
/// (domain-model.md, section 11): what failed, and a way to try again.
class ErrorState extends StatelessWidget {
  /// Creates the state with the [message] and the [onRetry] action.
  const new({
    required this.message,
    required this.onRetry,
    this.retryLabel = 'Tentar de novo',
    super.key,
  });

  /// What failed, in the customer's words.
  final String message;

  /// Loads the content again.
  final VoidCallback onRetry;

  /// Label of the retry action.
  final String retryLabel;

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(Icons.cloud_off_outlined, size: 32, color: colors.textMuted),
        const SizedBox(height: NbSpace.md),
        Text(
          message,
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.bodyMedium,
        ),
        const SizedBox(height: NbSpace.sm),
        TextButton(onPressed: onRetry, child: Text(retryLabel)),
      ],
    );
  }
}
