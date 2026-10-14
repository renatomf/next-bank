import 'package:flutter/widgets.dart';
import 'package:qr/qr.dart';

/// A QR Code of [data], drawn module by module from the matrix the `qr`
/// package computes (v1.1.0 plan, task 3). Always dark modules on white, with
/// the four-module quiet zone of the standard, in both themes: any camera
/// reads it, however the app looks.
class QrCodeView extends StatelessWidget {
  /// Creates the code, a square of [size] read aloud as [semanticLabel].
  const new({
    required this.data,
    required this.semanticLabel,
    this.size = 232,
    super.key,
  });

  /// The text the code carries.
  final String data;

  /// What screen readers say instead of the code.
  final String semanticLabel;

  /// Side of the square, quiet zone included.
  final double size;

  /// Dark modules: plain black reads best on any camera.
  static const Color dark = Color(0xFF000000);

  /// Background and quiet zone.
  static const Color light = Color(0xFFFFFFFF);

  /// Modules of blank border on each side, as the standard asks.
  static const int quietZone = 4;

  @override
  Widget build(BuildContext context) => Semantics(
    label: semanticLabel,
    image: true,
    child: CustomPaint(size: Size.square(size), painter: _QrPainter(data)),
  );
}

/// The dark modules of [data]'s QR Code, row by row, at level M (~15% of
/// the code can be damaged and still read).
List<List<bool>> qrModules(String data) {
  final image = QrImage(QrCode(payload: QrPayload.fromString(data)));
  return [
    for (var row = 0; row < image.moduleCount; row++)
      [
        for (var col = 0; col < image.moduleCount; col++)
          image.isDark(row, col),
      ],
  ];
}

class _QrPainter extends CustomPainter {
  new(this.data);

  final String data;

  // Computed once per code, on the first paint.
  late final List<List<bool>> modules = qrModules(data);

  @override
  void paint(Canvas canvas, Size size) {
    canvas.drawRect(Offset.zero & size, Paint()..color = QrCodeView.light);
    final count = modules.length + 2 * QrCodeView.quietZone;
    final module = size.width / count;
    final dark = Paint()..color = QrCodeView.dark;
    for (var row = 0; row < modules.length; row++) {
      for (var col = 0; col < modules[row].length; col++) {
        if (!modules[row][col]) continue;
        // A hair wider than the module, so no seam shows between neighbours.
        canvas.drawRect(
          Rect.fromLTWH(
            (col + QrCodeView.quietZone) * module,
            (row + QrCodeView.quietZone) * module,
            module + 0.5,
            module + 0.5,
          ),
          dark,
        );
      }
    }
  }

  @override
  bool shouldRepaint(_QrPainter old) => old.data != data;
}
