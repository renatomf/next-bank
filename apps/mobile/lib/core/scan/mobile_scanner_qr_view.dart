import 'dart:async';

import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:next_bank/core/scan/qr_scanner.dart';

/// [QrScannerBuilder] over mobile_scanner: the back camera reading only QR
/// Codes, on the device with ML Kit (E1). The camera permission is asked
/// when this view starts the camera, never before (MOB-10).
Widget mobileScannerQrView({
  required ValueChanged<String> onCode,
  required VoidCallback onCameraDenied,
}) => _MobileScannerQrView(onCode: onCode, onCameraDenied: onCameraDenied);

class _MobileScannerQrView extends StatefulWidget {
  const new({required this.onCode, required this.onCameraDenied});

  final ValueChanged<String> onCode;
  final VoidCallback onCameraDenied;

  @override
  State<_MobileScannerQrView> createState() => _MobileScannerQrViewState();
}

class _MobileScannerQrViewState extends State<_MobileScannerQrView> {
  final _controller = MobileScannerController(
    formats: const [BarcodeFormat.qrCode],
  );

  @override
  void dispose() {
    unawaited(_controller.dispose());
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => MobileScanner(
    controller: _controller,
    onDetect: (capture) {
      final code = capture.barcodes.firstOrNull?.rawValue;
      if (code != null) widget.onCode(code);
    },
    errorBuilder: (context, error) {
      if (error.errorCode == MobileScannerErrorCode.permissionDenied) {
        // Told after this frame: the screen changes what it shows.
        WidgetsBinding.instance.addPostFrameCallback(
          (_) => widget.onCameraDenied(),
        );
      }
      return const ColoredBox(color: Colors.black);
    },
  );
}
