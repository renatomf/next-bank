import 'dart:async';
import 'dart:math';
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/widgets.dart';

/// A fine grain laid over a gradient so an 8-bit screen shows a smooth ramp
/// instead of rings.
///
/// Browsers dither gradients, so the mockups look smooth. Impeller, Flutter's
/// renderer on Android, does not: a faint gradient on a dark ground, such as
/// the screen glow (10% mint over near-black), has only ~25 color steps to
/// spread over hundreds of pixels, and each step shows as a ring. Skia did
/// dither, but opting out of Impeller is deprecated. The grain is one
/// physical pixel per dot, blended in overlay mode: it hides the steps
/// without reading as texture. Paint it above the gradient and below the
/// content.
class Dither extends StatefulWidget {
  /// Creates the grain layer; it fills its parent and ignores touches.
  const new({super.key});

  @override
  State<Dither> createState() => _DitherState();
}

class _DitherState extends State<Dither> {
  /// One noise tile for the whole app, made once.
  static final Future<ui.Image> _noise = _makeNoise();

  ui.Image? _image;

  @override
  void initState() {
    super.initState();
    unawaited(
      _noise.then((image) {
        if (mounted) setState(() => _image = image);
      }),
    );
  }

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: CustomPaint(
        size: Size.infinite,
        painter: _GrainPainter(_image, MediaQuery.devicePixelRatioOf(context)),
      ),
    );
  }
}

class _GrainPainter extends CustomPainter {
  const new(this.image, this.devicePixelRatio);

  final ui.Image? image;
  final double devicePixelRatio;

  @override
  void paint(Canvas canvas, Size size) {
    final noise = image;
    if (noise == null) return;
    // One noise dot per physical pixel, however dense the screen.
    final scale = 1 / devicePixelRatio;
    final paint = Paint()
      ..blendMode = BlendMode.overlay
      ..color = const Color(0x1AFFFFFF)
      ..shader = ImageShader(
        noise,
        TileMode.repeated,
        TileMode.repeated,
        Matrix4.diagonal3Values(scale, scale, 1).storage,
      );
    canvas.drawRect(Offset.zero & size, paint);
  }

  @override
  bool shouldRepaint(_GrainPainter old) =>
      old.image != image || old.devicePixelRatio != devicePixelRatio;
}

/// A 128×128 tile of gray noise, the same on every run.
Future<ui.Image> _makeNoise() {
  const side = 128;
  final random = Random(7);
  final pixels = Uint8List(side * side * 4);
  for (var i = 0; i < pixels.length; i += 4) {
    final value = random.nextInt(256);
    pixels
      ..[i] = value
      ..[i + 1] = value
      ..[i + 2] = value
      ..[i + 3] = 255;
  }
  final done = Completer<ui.Image>();
  ui.decodeImageFromPixels(
    pixels,
    side,
    side,
    ui.PixelFormat.rgba8888,
    done.complete,
  );
  return done.future;
}
