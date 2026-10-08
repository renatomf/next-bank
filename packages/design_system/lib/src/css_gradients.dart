import 'dart:math';

import 'package:flutter/widgets.dart';

/// The mockups are HTML and CSS (brief, section 7.0.1). These helpers draw
/// their gradients with CSS geometry, so a surface matches the mockup at any
/// size: Flutter's own gradients are circles relative to the shortest side
/// and lines from edge to edge, which drift from the design.

/// CSS `radial-gradient(<rx> <ry> at <x> <y>, …)` over a box of [size]:
/// [center] and [radii] are fractions of the box, as CSS percentages.
RadialGradient cssRadialGradient({
  required Size size,
  required Offset center,
  required Size radii,
  required List<Color> colors,
  required List<double> stops,
}) {
  // The first frame lays the screen out at 0×0: nothing to draw yet, and the
  // ellipse below would divide by zero.
  if (!_drawable(size)) {
    return RadialGradient(colors: colors, stops: stops);
  }
  final rx = radii.width * size.width;
  final ry = radii.height * size.height;
  return RadialGradient(
    center: Alignment(center.dx * 2 - 1, center.dy * 2 - 1),
    // A circle of radius ry, stretched across to rx: the CSS ellipse.
    radius: ry / size.shortestSide,
    colors: colors,
    stops: stops,
    transform: _StretchX(
      rx / ry,
      Offset(center.dx * size.width, center.dy * size.height),
    ),
  );
}

/// CSS `linear-gradient(<angle>deg, …)` over a box of [size]: 0° points up,
/// 90° right, and the gradient line spans the box's corners, as in CSS.
LinearGradient cssLinearGradient({
  required Size size,
  required double angleDegrees,
  required List<Color> colors,
  required List<double> stops,
}) {
  if (!_drawable(size)) return LinearGradient(colors: colors, stops: stops);
  final angle = angleDegrees * pi / 180;
  final direction = Offset(sin(angle), -cos(angle));
  final halfLength =
      (size.width * sin(angle).abs() + size.height * cos(angle).abs()) / 2;
  final middle = size.center(Offset.zero);
  Alignment at(Offset point) => Alignment(
    point.dx / (size.width / 2) - 1,
    point.dy / (size.height / 2) - 1,
  );
  return LinearGradient(
    begin: at(middle - direction * halfLength),
    end: at(middle + direction * halfLength),
    colors: colors,
    stops: stops,
  );
}

bool _drawable(Size size) => size.isFinite && !size.isEmpty;

/// Stretches the gradient horizontally around [origin].
class _StretchX extends GradientTransform {
  const new(this.factor, this.origin);

  final double factor;
  final Offset origin;

  @override
  Matrix4 transform(Rect bounds, {TextDirection? textDirection}) {
    final x = bounds.left + origin.dx;
    final y = bounds.top + origin.dy;
    return Matrix4.translationValues(x, y, 0)
      ..multiply(Matrix4.diagonal3Values(factor, 1, 1))
      ..multiply(Matrix4.translationValues(-x, -y, 0));
  }
}
