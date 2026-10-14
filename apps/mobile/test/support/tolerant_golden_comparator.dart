import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

/// Compares goldens allowing a small share of different pixels: Windows and
/// the Linux of the CI raster text a little differently, and a golden should
/// fail on a changed layout, not on antialiasing.
class TolerantGoldenComparator extends LocalFileComparator {
  /// Compares against goldens beside [testFile], allowing [tolerance] (0 to
  /// 1) of the pixels to differ.
  new(super.testFile, {required this.tolerance});

  /// The share of pixels that may differ.
  final double tolerance;

  @override
  Future<bool> compare(Uint8List imageBytes, Uri golden) async {
    final result = await GoldenFileComparator.compareLists(
      imageBytes,
      await getGoldenBytes(golden),
    );
    if (result.passed || result.diffPercent <= tolerance) {
      result.dispose();
      return true;
    }
    final error = await generateFailureOutput(result, golden, basedir);
    result.dispose();
    throw FlutterError(error);
  }
}

/// Uses [TolerantGoldenComparator] for the goldens of [testFileName], which
/// lives in the same folder as the test calling this.
void useTolerantGoldens(String testFileName, {double tolerance = 0.01}) {
  final current = goldenFileComparator as LocalFileComparator;
  goldenFileComparator = TolerantGoldenComparator(
    current.basedir.resolve(testFileName),
    tolerance: tolerance,
  );
}

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
