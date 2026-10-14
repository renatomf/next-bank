import 'dart:io';

import 'package:flutter/services.dart';

/// Goldens are drawn and compared only on the CI's Linux: Windows rasters
/// text differently enough (~5% of pixels) to fail an honest comparison.
/// Redraw them with .github/workflows/goldens.yml.
final bool goldensRunHere = Platform.isLinux;

/// Loads the fonts the app draws with, so goldens show real letters and
/// icons instead of the test font's boxes.
Future<void> loadAppFonts() async {
  Future<void> load(String family, String path) async {
    final bytes = File(path).readAsBytesSync();
    await (FontLoader(
      family,
    )..addFont(Future.value(ByteData.sublistView(bytes)))).load();
  }

  const fonts = '../../packages/design_system/fonts';
  await load('packages/design_system/Sora', '$fonts/Sora-Variable.ttf');
  await load('packages/design_system/Manrope', '$fonts/Manrope-Variable.ttf');
  // The icon font comes with Flutter. Its file name changes case between
  // machines ("MaterialIcons-Regular.otf" on the Linux CI), so it is found
  // by name, ignoring case.
  final flutterRoot = Platform.environment['FLUTTER_ROOT'];
  final folder = Directory('$flutterRoot/bin/cache/artifacts/material_fonts');
  if (flutterRoot == null || !folder.existsSync()) return;
  final icons = folder.listSync().whereType<File>().where(
    (file) =>
        file.uri.pathSegments.last.toLowerCase() == 'materialicons-regular.otf',
  );
  if (icons.isNotEmpty) await load('MaterialIcons', icons.single.path);
}
