import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Draws the camera reading QR Codes: [onCode] gets each code read, and
/// [onCameraDenied] tells that the customer refused the camera (MOB-10).
typedef QrScannerBuilder = Widget Function({
  required ValueChanged<String> onCode,
  required VoidCallback onCameraDenied,
});

/// The camera; bound in main.dart to mobile_scanner, faked in tests so they
/// never need a camera.
final Provider<QrScannerBuilder> qrScannerProvider = Provider(
  (ref) => throw UnimplementedError('Bound in main.dart'),
);
