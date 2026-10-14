import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:next_bank/core/share/image_sharer.dart';

/// The system's share sheet without the system: keeps what it was given.
class FakeImageSharer implements ImageSharer {
  /// Images shared, in order.
  final List<({Uint8List png, String fileName, String caption})> shared = [];

  @override
  Future<void> shareImage({
    required Uint8List png,
    required String fileName,
    required String caption,
  }) async => shared.add((png: png, fileName: fileName, caption: caption));
}

/// Draws nothing: keeps the widgets it was asked to draw and answers with
/// [png], so flow tests need no real rendering.
class FakeWidgetPainter {
  /// What every drawing returns.
  final Uint8List png = Uint8List.fromList([1, 2, 3]);

  /// Widgets asked for, in order.
  final List<Widget> painted = [];

  /// The painter to bind in place of the real one.
  Future<Uint8List> call(Widget widget, {required double width}) async {
    painted.add(widget);
    return png;
  }
}
