import 'package:design_system/src/components/nb_text_field.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// Four-digit transaction PIN entry: digits only, hidden, never suggested or
/// autocorrected by the keyboard.
class PinField extends StatelessWidget {
  /// Creates the field.
  const new({
    required this.label,
    required this.controller,
    required this.revealLabels,
    this.errorText,
    this.onCompleted,
    this.enabled = true,
    super.key,
  });

  /// Read by screen readers.
  final String label;

  /// Holds the typed PIN.
  final TextEditingController controller;

  /// Shown when the PIN is refused.
  final String? errorText;

  /// Called when the fourth digit is typed.
  final ValueChanged<String>? onCompleted;

  /// False while the form is sending.
  final bool enabled;

  /// What the screen reader says on the button that shows or hides the PIN.
  final ({String show, String hide}) revealLabels;

  /// PIN length (domain-model.md 3.1).
  static const int length = 4;

  @override
  Widget build(BuildContext context) => NbTextField(
    label: label,
    controller: controller,
    errorText: errorText,
    enabled: enabled,
    keyboardType: TextInputType.number,
    obscureText: true,
    revealLabels: revealLabels,
    inputFormatters: [
      FilteringTextInputFormatter.digitsOnly,
      LengthLimitingTextInputFormatter(length),
    ],
    onChanged: (value) {
      if (value.length == length) onCompleted?.call(value);
    },
  );
}
