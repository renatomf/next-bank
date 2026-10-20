import 'package:design_system/src/theme.dart';
import 'package:design_system/src/tokens.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// A search field (v1.1.0 plan, task 4.17): a pill with the magnifier first,
/// the same in every list that filters. The hint is what the screen reader
/// reads, so it says what is searched.
class NbSearchField extends StatelessWidget {
  /// A field that reports each change of the query to [onChanged].
  const new({
    required this.hint,
    required this.onChanged,
    this.controller,
    this.maxLength,
    super.key,
  });

  /// What is searched, such as "Buscar banco".
  final String hint;

  /// Called with the query on every change.
  final ValueChanged<String> onChanged;

  /// Holds the query, when the screen needs to read or clear it.
  final TextEditingController? controller;

  /// The longest query the screen accepts, when there is a limit (the
  /// statement's server takes 60 characters, READ-04).
  final int? maxLength;

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;
    OutlineInputBorder pill(Color color, [double width = 1]) =>
        OutlineInputBorder(
          borderRadius: BorderRadius.circular(NbRadius.pill),
          borderSide: BorderSide(color: color, width: width),
        );

    return TextField(
      controller: controller,
      onChanged: onChanged,
      textInputAction: TextInputAction.search,
      inputFormatters: [
        if (maxLength case final max?) LengthLimitingTextInputFormatter(max),
      ],
      decoration: InputDecoration(
        hintText: hint,
        prefixIcon: Icon(Icons.search, color: colors.textMuted),
        border: pill(colors.border),
        enabledBorder: pill(colors.border),
        // The field theme's focus border has the field radius; a search
        // stays a pill while typed in.
        focusedBorder: pill(colors.accent, 1.5),
      ),
    );
  }
}
