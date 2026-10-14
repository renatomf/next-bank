import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/core/cpf_input_formatter.dart';

/// What the field shows after [typed] replaces [before]; the cursor sits at
/// [cursor] in [typed], or at its end.
TextEditingValue format(String before, String typed, {int? cursor}) =>
    const CpfInputFormatter().formatEditUpdate(
      TextEditingValue(
        text: before,
        selection: TextSelection.collapsed(offset: before.length),
      ),
      TextEditingValue(
        text: typed,
        selection: TextSelection.collapsed(offset: cursor ?? typed.length),
      ),
    );

// v1.1.0 plan, task 1.1: the customer types only digits and the Pix key
// field shows 000.000.000-00 as they go.
void main() {
  group('while typing', () {
    for (final (digits, shown) in [
      ('5', '5'),
      ('529', '529'),
      ('5299', '529.9'),
      ('529982', '529.982'),
      ('5299822', '529.982.2'),
      ('529982247', '529.982.247'),
      ('5299822472', '529.982.247-2'),
      ('52998224725', '529.982.247-25'),
    ]) {
      test('$digits shows as $shown, cursor at the end', () {
        final previous = digits.length == 1
            ? ''
            : format('', digits.substring(0, digits.length - 1)).text;

        final value = format(previous, '$previous${digits[digits.length - 1]}');

        expect(value.text, shown);
        expect(value.selection, TextSelection.collapsed(offset: shown.length));
      });
    }
  });

  test('never holds more than 11 digits', () {
    expect(format('529.982.247-25', '529.982.247-259').text, '529.982.247-25');
  });

  group('pasting', () {
    test('a masked CPF stays as it is', () {
      expect(format('', '529.982.247-25').text, '529.982.247-25');
    });

    test('bare digits get the mask', () {
      expect(format('', '52998224725').text, '529.982.247-25');
    });

    test('anything that is not a digit goes', () {
      expect(format('', ' 529 982 247 25 ').text, '529.982.247-25');
    });
  });

  group('deleting', () {
    test('the last digit keeps the mask of what is left', () {
      expect(format('529.982.247-25', '529.982.247-2').text, '529.982.247-2');
    });

    test('a digit in the middle keeps the cursor beside it', () {
      // "529.982.2|47-25": the 2 before the cursor (third group) is deleted.
      final value = format('529.982.247-25', '529.982.47-25', cursor: 8);

      expect(value.text, '529.982.472-5');
      expect(value.selection, const TextSelection.collapsed(offset: 8));
    });

    test('everything leaves the field empty', () {
      expect(format('5', '').text, '');
    });
  });
}
