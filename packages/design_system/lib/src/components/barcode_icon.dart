import 'package:flutter/widgets.dart';

/// A barcode drawn as an icon, for paying (S21 checkpoint of v1.1.0): the
/// Material icons only have a barcode reader. Like an [Icon], it takes the
/// size and color of the [IconTheme]; decoration only, as the shortcut's
/// label says what it does.
class BarcodeIcon extends StatelessWidget {
  /// Creates the icon; [size] overrides the theme's.
  const new({this.size, super.key});

  /// Side of the square; the icon theme's when null.
  final double? size;

  @override
  Widget build(BuildContext context) {
    final theme = IconTheme.of(context);
    final side = size ?? theme.size ?? 24;

    return ExcludeSemantics(
      child: CustomPaint(
        size: Size.square(side),
        painter: BarcodePainter(color: theme.color ?? const Color(0xFF000000)),
      ),
    );
  }
}

/// Paints the bars of [BarcodeIcon]: thin and thick lines, as a real code.
class BarcodePainter extends CustomPainter {
  /// Creates the painter in [color].
  const new({required this.color});

  /// The bars' color.
  final Color color;

  /// Bar and gap widths, alternating and starting with a bar, in units of
  /// the narrowest line.
  static const List<int> _pattern = [2, 1, 1, 1, 3, 1, 1, 2, 2, 1, 1, 1, 3];

  @override
  void paint(Canvas canvas, Size size) {
    final units = _pattern.fold(0, (sum, width) => sum + width);
    final unit = size.width / units;
    // Shorter than the square, as the glyphs of the Material icons.
    final top = size.height * 0.2;
    final height = size.height * 0.6;
    final paint = Paint()..color = color;

    var x = 0.0;
    for (final (index, width) in _pattern.indexed) {
      final isBar = index.isEven;
      if (isBar) {
        canvas.drawRect(Rect.fromLTWH(x, top, width * unit, height), paint);
      }
      x += width * unit;
    }
  }

  @override
  bool shouldRepaint(BarcodePainter oldDelegate) => oldDelegate.color != color;
}
