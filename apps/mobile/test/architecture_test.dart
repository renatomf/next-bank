import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

/// Clean Architecture dependency rule (CLAUDE.md, section 3):
/// - features never import other features;
/// - domain is plain Dart: no Flutter, Riverpod, Dio, data or presentation;
/// - presentation never imports data (the composition root wires them).
void main() {
  test('layers follow the dependency rule', () {
    final violations = <String>[];

    for (final file in dartFiles('lib/features')) {
      final path = file.path.replaceAll(r'\', '/');
      final source = layerOf(path);
      if (source == null) continue;

      for (final import in importsOf(file)) {
        final target = layerOf(import);

        if (target != null && target.feature != source.feature) {
          violations.add('$path imports another feature: $import');
        }
        if (source.layer == 'domain' && !isAllowedInDomain(import, target)) {
          violations.add('$path: domain must be plain Dart, got $import');
        }
        if (source.layer == 'presentation' && target?.layer == 'data') {
          violations.add('$path: presentation imports data: $import');
        }
      }
    }

    expect(violations, isEmpty, reason: violations.join('\n'));
  });

  // core holds what every feature shares, so it depends on none of them;
  // only app/ and main.dart compose the features.
  test('core never imports a feature or the app', () {
    final violations = [
      for (final file in dartFiles('lib/core'))
        for (final import in importsOf(file))
          if (import.startsWith('package:next_bank/features/') ||
              import.startsWith('package:next_bank/app/'))
            '${file.path}: $import',
    ];

    expect(violations, isEmpty, reason: violations.join('\n'));
  });

  // ADR 0014 (G1): screens read the brief's text styles from the theme, so a
  // style or a mode color changes in one place. Only components draw with
  // tokens: core/ui (the bank's) and the design system (F-36).
  test('screens read text styles from the theme', () {
    final violations = [
      for (final file in dartFiles('lib/features'))
        for (final (index, line) in file.readAsLinesSync().indexed)
          if (line.contains('NbType.'))
            '${file.path}:${index + 1}: use context.nbText instead of NbType',
    ];

    expect(violations, isEmpty, reason: violations.join('\n'));
  });

  // ADR 0014 (G1): boxes, circles, tags and switches come from the design
  // system, so their look changes in one place. The exceptions draw
  // something no other screen has; each says why.
  test('screens build no boxes, colors or switches by hand', () {
    const exceptions = {
      // The receipt image, always light whatever the theme.
      'lib/features/pix/presentation/receipt/shareable_receipt.dart',
      // The fade from the glass art into the background.
      'lib/features/unlock/presentation/unlock_screen.dart',
      // The carousel's page dots, used once.
      'lib/features/cards/presentation/cards_screen.dart',
      // The unread count, a round tag used once.
      'lib/features/notifications/presentation/inbox/notification_tile.dart',
    };
    const banned = {
      'BoxDecoration(': 'NbSurface, NbIconCircle or NbTag',
      'Color(0x': 'a color of context.nbColors',
      ' Switch(': 'NbSwitch',
    };
    final violations = [
      for (final file in dartFiles('lib/features'))
        if (!exceptions.contains(file.path.replaceAll(r'\', '/')))
          for (final (index, line) in file.readAsLinesSync().indexed)
            for (final MapEntry(key: code, value: use) in banned.entries)
              if (line.contains(code))
                '${file.path}:${index + 1}: use $use instead of $code',
    ];

    expect(violations, isEmpty, reason: violations.join('\n'));
  });

  // MOB-01: nothing sensitive in plain preferences; tokens live only in the
  // Keychain / Keystore. V1 has nothing else to store there either.
  test('the app never uses shared preferences', () {
    final users = [
      for (final file in dartFiles('lib'))
        if (importsOf(file).any((i) => i.startsWith('package:shared_prefer')))
          file.path,
    ];

    expect(users, isEmpty, reason: users.join('\n'));
  });
}

typedef Layer = ({String feature, String layer});

/// Feature and layer of a path like `lib/features/home/domain/x.dart`.
Layer? layerOf(String path) {
  final match = RegExp(r'features/(\w+)/(domain|data|presentation)/')
      .firstMatch(path);
  return match == null ? null : (feature: match[1]!, layer: match[2]!);
}

bool isAllowedInDomain(String import, Layer? target) {
  const frameworks = [
    'package:flutter/',
    'package:flutter_riverpod/',
    'package:dio/',
  ];
  final isFramework = frameworks.any(import.startsWith);
  final isOuterLayer = target != null && target.layer != 'domain';
  return !isFramework && !isOuterLayer;
}

List<String> importsOf(File file) => RegExp(
  r"^import\s+'([^']+)'",
  multiLine: true,
).allMatches(file.readAsStringSync()).map((match) => match[1]!).toList();

List<File> dartFiles(String directory) =>
    Directory(directory)
        .listSync(recursive: true)
        .whereType<File>()
        .where((file) => file.path.endsWith('.dart'))
        .toList();
