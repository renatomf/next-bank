import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

// ADR 0014 (G2): the design system knows no bank and speaks no language of
// its own; every text a person reads or hears comes from the app.
void main() {
  test('the design system has no interface copy of its own', () {
    const allowed = {
      // Font families and the package that bundles the fonts and the art.
      'Sora', 'Manrope', 'monospace', 'design_system',
      // The product's own name, in its logo.
      'next', 'next bank',
      // The currency format: formatting money is the design system's job
      // (ADR 0006).
      r'R\$ $integer$decimals',
    };
    // Where a widget takes text to show or to read aloud, defaults, and the
    // branches of a choice between texts.
    final takesText = RegExp(
      r"(Text\(|[lL]abel: |hint\w*: |tooltip: |= |\?\? |\? |: )'([^']*)'",
    );
    // Code inside a string, closed or cut by a quote of its own, and escapes
    // such as \n, which are not words either.
    final notWords = RegExp(r'\$\{[^}]*(\}|$)|\$\w+|\\.');
    final letter = RegExp('[A-Za-zÀ-ú]');
    String violation(File file, int index, String text) =>
        '${file.path}:${index + 1}: "$text" should be a parameter';

    final violations = [
      for (final file in Directory('lib').listSync(recursive: true))
        if (file is File && file.path.endsWith('.dart'))
          for (final (index, line) in file.readAsLinesSync().indexed)
            if (!line.trimLeft().startsWith('//'))
              for (final match in takesText.allMatches(line))
                if (match[2]! case final text
                    when !allowed.contains(text) &&
                        letter.hasMatch(text.replaceAll(notWords, '')))
                  violation(file, index, text),
    ];

    expect(violations, isEmpty, reason: violations.join('\n'));
  });

  // ADR 0014 (G3): four layers, each built only on the ones before it, so a
  // token never depends on a widget and a component never on a pattern.
  test('every file sits in a layer and imports only the layers before it', () {
    const layers = ['tokens', 'theme', 'components', 'patterns'];
    final layerOf = RegExp(r'src[/\\](\w+)[/\\]');
    final importedLayer = RegExp(r"^import 'package:design_system/src/(\w+)/");

    final violations = <String>[];
    for (final file in Directory('lib/src').listSync(recursive: true)) {
      if (file is! File || !file.path.endsWith('.dart')) continue;
      final layer = layerOf.firstMatch(file.path)?[1];
      if (!layers.contains(layer)) {
        violations.add(
          '${file.path}: not in tokens/, theme/, components/ '
          'or patterns/',
        );
        continue;
      }
      for (final line in file.readAsLinesSync()) {
        final target = importedLayer.firstMatch(line)?[1];
        if (target != null && layers.indexOf(target) > layers.indexOf(layer!)) {
          violations.add('${file.path}: $layer cannot import $target');
        }
      }
    }

    expect(violations, isEmpty, reason: violations.join('\n'));
  });
}
