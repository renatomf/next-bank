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
