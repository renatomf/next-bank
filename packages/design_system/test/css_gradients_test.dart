import 'package:design_system/src/css_gradients.dart';
import 'package:flutter/painting.dart';
import 'package:flutter_test/flutter_test.dart';

const _colors = [Color(0xFF000000), Color(0xFFFFFFFF)];
const _stops = [0.0, 1.0];

LinearGradient linear(double angle, {Size size = const Size(350, 214)}) =>
    cssLinearGradient(
      size: size,
      angleDegrees: angle,
      colors: _colors,
      stops: _stops,
    );

Matcher closeToAlignment(double x, double y) => isA<Alignment>()
    .having((a) => a.x, 'x', closeTo(x, 0.001))
    .having((a) => a.y, 'y', closeTo(y, 0.001));

// The mockups' CSS geometry, reproduced (balance card, screen glow).
void main() {
  group('cssLinearGradient', () {
    test('90deg runs from the left edge to the right edge', () {
      final gradient = linear(90);

      expect(gradient.begin, closeToAlignment(-1, 0));
      expect(gradient.end, closeToAlignment(1, 0));
    });

    test('180deg runs from the top edge to the bottom edge', () {
      final gradient = linear(180);

      expect(gradient.begin, closeToAlignment(0, -1));
      expect(gradient.end, closeToAlignment(0, 1));
    });

    // In CSS the gradient line of a diagonal reaches the corners.
    test('a diagonal spans corner to corner, as CSS does', () {
      final gradient = linear(135, size: const Size(200, 200));

      expect(gradient.begin, closeToAlignment(-1, -1));
      expect(gradient.end, closeToAlignment(1, 1));
    });
  });

  // Found on the emulator: the first frame lays the screen out at 0×0, and
  // the radius became NaN ("Matrix4 entries must be finite").
  test('tolerates the empty box of the first frame', () {
    final radial = cssRadialGradient(
      size: Size.zero,
      center: const Offset(0.95, 0),
      radii: const Size(0.7, 0.35),
      colors: _colors,
      stops: _stops,
    );
    final linear = cssLinearGradient(
      size: Size.zero,
      angleDegrees: 160,
      colors: _colors,
      stops: _stops,
    );

    expect(radial.radius.isFinite, isTrue);
    final matrix = radial.transform?.transform(Rect.zero);
    expect(matrix?.storage.every((value) => value.isFinite) ?? true, isTrue);
    expect(
      linear.begin,
      isA<Alignment>().having((a) => a.x.isFinite, 'x', true),
    );
    expect(linear.end, isA<Alignment>().having((a) => a.y.isFinite, 'y', true));
  });

  group('cssRadialGradient', () {
    test('places the center by percentages of the box', () {
      final gradient = cssRadialGradient(
        size: const Size(350, 214),
        center: const Offset(0.92, 0.08),
        radii: const Size(0.7, 0.9),
        colors: _colors,
        stops: _stops,
      );

      expect(gradient.center, closeToAlignment(0.84, -0.84));
      // Vertical radius 90% of 214 px, as a fraction of the shortest side.
      expect(gradient.radius, closeTo(0.9, 0.001));
    });

    test('stretches the circle into the CSS ellipse', () {
      final gradient = cssRadialGradient(
        size: const Size(400, 200),
        center: const Offset(0.5, 0.5),
        radii: const Size(0.5, 0.5),
        colors: _colors,
        stops: _stops,
      );
      final matrix = gradient.transform!.transform(
        const Rect.fromLTWH(0, 0, 400, 200),
      )!;

      // Radius 100 px across becomes 200 px: x scaled by rx / ry = 2.
      expect(matrix.getRow(0)[0], closeTo(2, 0.001));
      expect(matrix.getRow(1)[1], closeTo(1, 0.001));
    });
  });
}
