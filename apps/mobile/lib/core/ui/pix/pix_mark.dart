import 'package:flutter/widgets.dart';

/// The official Pix symbol, without the wordmark (week 8 plan, V6). Pix is a
/// mark of the Banco Central do Brasil; next bank is a fictitious project
/// that uses it by the developer's exception to the rule on third-party marks,
/// with a notice in the README. Read as "Pix" by screen readers.
class PixMark extends StatelessWidget {
  /// Creates the symbol, a square of [size].
  const new({this.size = 24, super.key});

  /// Side of the square.
  final double size;

  /// The official color of the symbol.
  static const Color color = Color(0xFF32BCAD);

  @override
  Widget build(BuildContext context) => Semantics(
    label: 'Pix',
    image: true,
    child: CustomPaint(size: Size.square(size), painter: const _PixPainter()),
  );
}

class _PixPainter extends CustomPainter {
  const new();

  /// Side of the symbol in the official SVG's units.
  static const double _side = 315.6;

  /// The symbol's three pieces, from the official SVG (pix-106.svg), moved so
  /// the symbol starts at the origin. Converted once; not meant to be edited.
  static final List<Path> _pieces = [
    Path()
      ..moveTo(246.13, 241.43)
      ..arcToPoint(
        const Offset(213.35, 227.9),
        radius: const Radius.circular(46.07),
      )
      ..lineTo(166, 180.52)
      ..arcToPoint(
        const Offset(153.56, 180.52),
        radius: const Radius.circular(9),
        clockwise: false,
      )
      ..lineTo(106.05, 228.03)
      ..arcToPoint(
        const Offset(73.27, 241.6),
        radius: const Radius.circular(46.09),
      )
      ..lineTo(64, 241.6)
      ..lineTo(124, 301.6)
      ..arcToPoint(
        const Offset(191.81, 301.6),
        radius: const Radius.circular(48),
        clockwise: false,
      )
      ..lineTo(251.93, 241.47)
      ..close(),

    Path()
      ..moveTo(73.28, 73.99)
      ..arcToPoint(
        const Offset(106.06, 87.56),
        radius: const Radius.circular(46.08),
      )
      ..lineTo(153.57, 135.08)
      ..arcToPoint(
        const Offset(166.01, 135.08),
        radius: const Radius.circular(8.81),
        clockwise: false,
      )
      ..lineTo(213.35, 87.74)
      ..arcToPoint(
        const Offset(246.13, 74.16),
        radius: const Radius.circular(46),
      )
      ..lineTo(251.83, 74.16)
      ..lineTo(191.71, 14.04)
      ..arcToPoint(
        const Offset(123.9, 14.04),
        radius: const Radius.circular(47.94),
        clockwise: false,
      )
      ..lineTo(64, 73.99)
      ..close(),

    Path()
      ..moveTo(301.56, 123.9)
      ..lineTo(265.23, 87.57)
      ..arcToPoint(
        const Offset(262.65, 88.09),
        radius: const Radius.circular(7),
      )
      ..lineTo(246.13, 88.09)
      ..arcToPoint(
        const Offset(223.2, 97.59),
        radius: const Radius.circular(32.62),
        clockwise: false,
      )
      ..lineTo(175.86, 144.9)
      ..arcToPoint(
        const Offset(143.73, 144.9),
        radius: const Radius.circular(22.74),
      )
      ..lineTo(96.21, 97.41)
      ..arcToPoint(
        const Offset(73.28, 87.9),
        radius: const Radius.circular(32.62),
        clockwise: false,
      )
      ..lineTo(53, 87.9)
      ..arcToPoint(
        const Offset(50.56, 87.41),
        radius: const Radius.circular(7.12),
      )
      ..lineTo(14, 123.9)
      ..arcToPoint(
        const Offset(14, 191.71),
        radius: const Radius.circular(48),
        clockwise: false,
      )
      ..lineTo(50.48, 228.19)
      ..arcToPoint(
        const Offset(52.92, 227.7),
        radius: const Radius.circular(6.85),
      )
      ..lineTo(73.28, 227.7)
      ..arcToPoint(
        const Offset(96.21, 218.19),
        radius: const Radius.circular(32.63),
        clockwise: false,
      )
      ..lineTo(143.72, 170.68)
      ..cubicTo(152.31, 162.1, 167.28, 162.1, 175.86, 170.68)
      ..lineTo(223.2, 218.01)
      ..arcToPoint(
        const Offset(246.13, 227.51),
        radius: const Radius.circular(32.62),
        clockwise: false,
      )
      ..lineTo(262.65, 227.51)
      ..arcToPoint(
        const Offset(265.23, 228.03),
        radius: const Radius.circular(6.9),
      )
      ..lineTo(301.56, 191.7)
      ..arcToPoint(
        const Offset(301.56, 123.89),
        radius: const Radius.circular(47.94),
        clockwise: false,
      ),
  ];

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = PixMark.color;
    canvas.scale(size.width / _side, size.height / _side);
    for (final piece in _pieces) {
      canvas.drawPath(piece, paint);
    }
  }

  @override
  bool shouldRepaint(_PixPainter oldDelegate) => false;
}
