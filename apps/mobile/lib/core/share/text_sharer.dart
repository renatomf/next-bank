import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Hands a text to the phone's share sheet, such as the "Copia e Cola" of a
/// QR Code to receive (v1.1.0 plan, task 3).
abstract interface class TextSharer {
  /// Opens the share sheet with [text] alone.
  Future<void> shareText(String text);
}

/// The share sheet for texts; bound in main.dart.
final Provider<TextSharer> textSharerProvider = Provider(
  (ref) => throw UnimplementedError('Bound in main.dart'),
);
