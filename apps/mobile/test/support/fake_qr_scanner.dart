import 'package:flutter/material.dart';

/// The camera without a camera: a button that "reads" [code], or the camera
/// refused when [denied].
class FakeQrScanner {
  /// What the next read finds.
  String code = '';

  /// Whether the customer refused the camera.
  bool denied = false;

  /// Builds the stand-in for the camera view.
  Widget call({
    required ValueChanged<String> onCode,
    required VoidCallback onCameraDenied,
  }) {
    if (denied) {
      WidgetsBinding.instance.addPostFrameCallback((_) => onCameraDenied());
    }
    return Center(
      child: TextButton(
        onPressed: () => onCode(code),
        child: const Text('Câmera de teste'),
      ),
    );
  }
}
