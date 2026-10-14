import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Hands text to the phone's share sheet: WhatsApp, e-mail and whatever else
/// the customer has installed (v1.1.0 plan, task 1).
abstract interface class TextSharer {
  /// Opens the share sheet with [text].
  Future<void> share(String text);
}

/// The share sheet; bound in main.dart.
final Provider<TextSharer> textSharerProvider = Provider(
  (ref) => throw UnimplementedError('Bound in main.dart'),
);
