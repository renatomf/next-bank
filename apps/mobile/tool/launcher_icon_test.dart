// Generates the Android launcher icons from the logo (week 8 plan, task 4).
// Not part of the test suite (it lives outside test/): run it by hand when the
// logo changes, and commit the PNGs it writes.
//   flutter test tool/launcher_icon_test.dart --update-goldens
import 'dart:io';

import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

/// The brand background of the dark theme (NbColors.dark.background).
const Color _background = Color(0xFF0A0F14);

/// Density buckets and the size of each icon in pixels.
const Map<String, ({int legacy, int foreground})> _densities = {
  'mdpi': (legacy: 48, foreground: 108),
  'hdpi': (legacy: 72, foreground: 162),
  'xhdpi': (legacy: 96, foreground: 216),
  'xxhdpi': (legacy: 144, foreground: 324),
  'xxxhdpi': (legacy: 192, foreground: 432),
};

const String _res = '../android/app/src/main/res';

Future<void> _loadSora() async {
  final bytes = File('../../packages/design_system/fonts/Sora-Variable.ttf')
      .readAsBytesSync();
  await (FontLoader(
    'packages/design_system/Sora',
  )..addFont(Future.value(ByteData.sublistView(bytes)))).load();
}

Widget _icon({
  required double size,
  required double logoSize,
  required bool withBackground,
  Offset shift = Offset.zero,
}) => MediaQuery(
  data: const MediaQueryData(),
  child: Directionality(
    textDirection: TextDirection.ltr,
    child: RepaintBoundary(
      child: Container(
        width: size,
        height: size,
        alignment: Alignment.center,
        // The legacy icon is a full rounded square; the adaptive foreground is
        // transparent and the launcher draws the background colour.
        decoration: withBackground
            ? BoxDecoration(
                color: _background,
                borderRadius: BorderRadius.circular(size * 0.22),
              )
            : null,
        child: Transform.translate(
          offset: shift,
          child: NextLogo(word: 'n', size: logoSize, color: Colors.white),
        ),
      ),
    ),
  ),
);

/// How far to move the logo so what is drawn ("n" and dot) sits in the
/// middle: the text box keeps room for tall letters the "n" never uses.
Future<Offset> _centering(
  WidgetTester tester,
  double size,
  double logoSize,
) async {
  await tester.pumpWidget(
    _icon(size: size, logoSize: logoSize, withBackground: false),
  );
  final boundary = tester.renderObject<RenderRepaintBoundary>(
    find.byType(RepaintBoundary).first,
  );
  final pixels = (await tester.runAsync(() async {
    final image = await boundary.toImage();
    return await image.toByteData();
  }))!;
  final side = size.toInt();
  var (left, top, right, bottom) = (side, side, -1, -1);
  for (var y = 0; y < side; y++) {
    for (var x = 0; x < side; x++) {
      if (pixels.getUint8((y * side + x) * 4 + 3) > 0) {
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
  }
  return Offset(
    size / 2 - (left + right + 1) / 2,
    size / 2 - (top + bottom + 1) / 2,
  );
}

void main() {
  setUpAll(_loadSora);

  for (final MapEntry(key: density, value: sizes) in _densities.entries) {
    for (final (name, size, withBackground) in [
      ('ic_launcher', sizes.legacy, true),
      ('ic_launcher_foreground', sizes.foreground, false),
    ]) {
      testWidgets('$name $density', (tester) async {
        final side = size.toDouble();
        // The adaptive icon is cut to its central 66 of 108 dp.
        final logoSize = side * (withBackground ? 0.58 : 0.40);
        tester.view
          ..physicalSize = Size.square(side)
          ..devicePixelRatio = 1;
        addTearDown(tester.view.reset);
        final shift = await _centering(tester, side, logoSize);
        await tester.pumpWidget(
          _icon(
            size: side,
            logoSize: logoSize,
            withBackground: withBackground,
            shift: shift,
          ),
        );
        await expectLater(
          find.byType(RepaintBoundary).first,
          matchesGoldenFile('$_res/mipmap-$density/$name.png'),
        );
      });
    }
  }
}
