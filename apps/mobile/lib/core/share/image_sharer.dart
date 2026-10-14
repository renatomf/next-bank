import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Hands an image to the phone's share sheet: WhatsApp, e-mail and whatever
/// else the customer has installed (v1.1.0 plan, task 1).
abstract interface class ImageSharer {
  /// Opens the share sheet with [png] alone, named [fileName].
  Future<void> shareImage({required Uint8List png, required String fileName});
}

/// The share sheet; bound in main.dart.
final Provider<ImageSharer> imageSharerProvider = Provider(
  (ref) => throw UnimplementedError('Bound in main.dart'),
);
