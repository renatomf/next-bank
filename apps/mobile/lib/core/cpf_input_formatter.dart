import 'package:flutter/services.dart';

/// Shows a CPF as 000.000.000-00 while the customer types only digits (v1.1.0
/// plan, task 1.1). Pasting works with or without the punctuation, nothing
/// but digits stays, and never more than 11. The mask is only for the eye:
/// whoever reads the field keeps the digits.
class CpfInputFormatter extends TextInputFormatter {
  /// Creates the formatter.
  const new();

  static const int _maxDigits = 11;

  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    final cursor = newValue.selection.baseOffset.clamp(0, newValue.text.length);
    final digits = _digitsOf(newValue.text);
    final digitsBeforeCursor = _digitsOf(newValue.text.substring(0, cursor));
    final kept = digits.length > _maxDigits
        ? digits.substring(0, _maxDigits)
        : digits;
    final text = _mask(kept);
    return TextEditingValue(
      text: text,
      selection: TextSelection.collapsed(
        offset: _offsetAfter(
          text,
          digitsBeforeCursor.length.clamp(0, kept.length),
        ),
      ),
    );
  }

  static String _digitsOf(String text) => text.replaceAll(RegExp(r'\D'), '');

  /// "529", "529.9", ... "529.982.247-25": each separator appears only once
  /// a digit follows it.
  static String _mask(String digits) {
    final text = StringBuffer();
    for (var i = 0; i < digits.length; i++) {
      if (i == 3 || i == 6) text.write('.');
      if (i == 9) text.write('-');
      text.write(digits[i]);
    }
    return text.toString();
  }

  /// Where the cursor goes after [count] digits of [text]: right after the
  /// last of them, and past a separator that follows, so the next digit
  /// typed lands where the customer expects.
  static int _offsetAfter(String text, int count) {
    var seen = 0;
    var offset = 0;
    while (offset < text.length && seen < count) {
      if (_isDigit(text.codeUnitAt(offset))) seen++;
      offset++;
    }
    while (count > 0 &&
        offset < text.length &&
        !_isDigit(text.codeUnitAt(offset))) {
      offset++;
    }
    return offset;
  }

  static bool _isDigit(int unit) => unit >= 0x30 && unit <= 0x39;
}
