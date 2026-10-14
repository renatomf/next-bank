import 'dart:ui' as ui;

import 'package:flutter/foundation.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Draws [widget] at [width] and returns it as a PNG.
typedef WidgetPainter = Future<Uint8List> Function(
  Widget widget, {
  required double width,
});

/// How the app turns a widget into an image; tests bind a fake.
final Provider<WidgetPainter> widgetPainterProvider = Provider(
  (ref) => paintWidgetToPng,
);

// No receipt is taller than this; the image takes only the height it needs.
const double _maxHeight = 4000;

/// Draws [widget] off screen, in a render tree of its own, at [width] and at
/// the height its content needs, and returns it as a PNG at [pixelRatio].
/// Nothing on screen changes, and what is on screen never leaks into it.
Future<Uint8List> paintWidgetToPng(
  Widget widget, {
  required double width,
  double pixelRatio = 3,
}) async {
  final boundary = RenderRepaintBoundary();
  final view = WidgetsBinding.instance.platformDispatcher.implicitView!;
  final renderView = RenderView(
    view: view,
    child: RenderPositionedBox(alignment: Alignment.topLeft, child: boundary),
    configuration: ViewConfiguration(
      logicalConstraints: BoxConstraints(
        maxWidth: width,
        maxHeight: _maxHeight,
      ),
      devicePixelRatio: pixelRatio,
    ),
  );
  final pipeline = PipelineOwner()..rootNode = renderView;
  renderView.prepareInitialFrame();
  final focus = FocusManager();
  final buildOwner = BuildOwner(focusManager: focus);
  final root = RenderObjectToWidgetAdapter<RenderBox>(
    container: boundary,
    child: MediaQuery(
      data: MediaQueryData(
        size: Size(width, _maxHeight),
        devicePixelRatio: pixelRatio,
      ),
      child: Directionality(
        textDirection: TextDirection.ltr,
        child: SizedBox(width: width, child: widget),
      ),
    ),
  ).attachToRenderTree(buildOwner);
  buildOwner
    ..buildScope(root)
    ..finalizeTree();
  pipeline
    ..flushLayout()
    ..flushCompositingBits()
    ..flushPaint();
  final image = await boundary.toImage(pixelRatio: pixelRatio);
  try {
    final data = await image.toByteData(format: ui.ImageByteFormat.png);
    return data!.buffer.asUint8List();
  } finally {
    image.dispose();
    focus.dispose();
  }
}
