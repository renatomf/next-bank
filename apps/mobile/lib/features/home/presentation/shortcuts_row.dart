import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';

/// The Home's four shortcuts, side by side across the width (S21 checkpoint
/// of v1.1.0): Área Pix, Pagar, Transferir and Recarga. Recarga comes with
/// its screen and says so for now (week 8 plan, V7); "Receber" lives in the
/// Pix box.
class ShortcutsRow extends StatelessWidget {
  /// Creates the row; the Home says where each shortcut goes.
  const new({
    required this.onPix,
    required this.onPay,
    required this.onTransfer,
    super.key,
  });

  /// Opens the Pix area.
  final VoidCallback onPix;

  /// Opens the reading of a Pix QR Code; the boleto's barcode comes later.
  final VoidCallback onPay;

  /// Opens the transfer (v1.1.0 plan, task 4.9).
  final VoidCallback onTransfer;

  @override
  Widget build(BuildContext context) {
    void sayComingSoon() =>
        showNbToast(context, 'Em breve.', icon: Icons.info_outline);

    // Each tile takes an equal share of the width, so the four keep one size
    // (week 8 plan, V13).
    return Row(
      spacing: NbSpace.sm,
      children: [
        Expanded(
          child: ActionTile(
            icon: const PixMark(),
            label: 'Área Pix',
            onPressed: onPix,
          ),
        ),
        Expanded(
          child: ActionTile(
            icon: const BarcodeIcon(),
            label: 'Pagar',
            onPressed: onPay,
          ),
        ),
        Expanded(
          child: ActionTile(
            // The arrows fill less of their box than the other glyphs; scaled,
            // they look the same size without changing the tile (S21
            // checkpoint).
            icon: Transform.scale(
              scale: 1.25,
              child: const Icon(Icons.swap_horiz),
            ),
            label: 'Transferir',
            onPressed: onTransfer,
          ),
        ),
        Expanded(
          child: ActionTile(
            icon: const Icon(Icons.phone_android),
            label: 'Recarga',
            onPressed: sayComingSoon,
          ),
        ),
      ],
    );
  }
}
