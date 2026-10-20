import 'package:design_system/src/theme.dart';
import 'package:design_system/src/tokens.dart';
import 'package:flutter/material.dart';

/// Asks before an action that cannot be undone, such as ending a session
/// (domain-model.md 11). Resolves to true only when [confirmLabel] is chosen;
/// dismissing it counts as no.
Future<bool> showConfirmDialog(
  BuildContext context, {
  required String title,
  required String message,
  required String confirmLabel,
  required String cancelLabel,
}) async {
  final confirmed = await showDialog<bool>(
    context: context,
    builder: (context) => ConfirmDialog(
      title: title,
      message: message,
      confirmLabel: confirmLabel,
      cancelLabel: cancelLabel,
    ),
  );
  return confirmed ?? false;
}

/// The dialog of [showConfirmDialog]: the action named on its button, in the
/// danger color, beside a way out.
class ConfirmDialog extends StatelessWidget {
  /// Creates the dialog.
  const new({
    required this.title,
    required this.message,
    required this.confirmLabel,
    required this.cancelLabel,
    super.key,
  });

  /// What is about to happen.
  final String title;

  /// What it means for the customer.
  final String message;

  /// The action, e.g. "Encerrar".
  final String confirmLabel;

  /// The way out.
  final String cancelLabel;

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;
    return AlertDialog(
      backgroundColor: colors.surface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(NbRadius.box),
      ),
      title: Text(
        title,
        style: NbType.sectionTitle.copyWith(color: colors.text),
      ),
      content: Text(
        message,
        style: NbType.bodyText.copyWith(color: colors.textMuted),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(false),
          child: Text(cancelLabel),
        ),
        TextButton(
          onPressed: () => Navigator.of(context).pop(true),
          style: TextButton.styleFrom(foregroundColor: colors.danger),
          child: Text(confirmLabel),
        ),
      ],
    );
  }
}
