import 'package:design_system/src/theme.dart';
import 'package:design_system/src/tokens.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// Text field with its label above (brief, section 7). Error messages are text,
/// never color only (brief, section 8).
class NbTextField extends StatelessWidget {
  /// Creates the field.
  const new({
    required this.label,
    this.controller,
    this.errorText,
    this.keyboardType,
    this.obscureText = false,
    this.autofillHints,
    this.textInputAction,
    this.inputFormatters,
    this.onChanged,
    this.onSubmitted,
    this.enabled = true,
    this.readOnly = false,
    this.suffix,
    super.key,
  });

  /// Shown above the field and read by screen readers.
  final String label;

  /// Holds the typed text.
  final TextEditingController? controller;

  /// Shown under the field when the value is invalid.
  final String? errorText;

  /// Keyboard to show.
  final TextInputType? keyboardType;

  /// Hides the text (passwords).
  final bool obscureText;

  /// Lets the platform fill the field (e-mail, password).
  final Iterable<String>? autofillHints;

  /// Action key of the keyboard.
  final TextInputAction? textInputAction;

  /// Restricts what can be typed.
  final List<TextInputFormatter>? inputFormatters;

  /// Called on every change.
  final ValueChanged<String>? onChanged;

  /// Called when the keyboard's action key is pressed (for example, "done"
  /// on the last field submits the form).
  final ValueChanged<String>? onSubmitted;

  /// False while the form is sending.
  final bool enabled;

  /// Shows a value the user reads but cannot type over, such as the
  /// fictitious CPF the app draws.
  final bool readOnly;

  /// Optional widget at the end of the field (e.g. a button).
  final Widget? suffix;

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: NbType.bodyText.copyWith(color: colors.textMuted)),
        const SizedBox(height: NbSpace.sm),
        TextField(
          controller: controller,
          keyboardType: keyboardType,
          obscureText: obscureText,
          enableSuggestions: !obscureText,
          autocorrect: !obscureText,
          autofillHints: autofillHints,
          textInputAction: textInputAction,
          inputFormatters: inputFormatters,
          onChanged: onChanged,
          onSubmitted: onSubmitted,
          enabled: enabled,
          readOnly: readOnly,
          style: NbType.bodyText.copyWith(color: colors.text),
          decoration: InputDecoration(
            errorText: errorText,
            errorMaxLines: 3,
            suffixIcon: suffix,
            semanticCounterText: '',
          ),
        ),
      ],
    );
  }
}
