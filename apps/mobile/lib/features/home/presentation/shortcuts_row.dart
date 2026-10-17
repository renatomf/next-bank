import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';

/// The Home's shortcuts, scrolling sideways. Transferir and Recarga come
/// with their screens and say so for now (week 8 plan, V7).
class ShortcutsRow extends StatelessWidget {
  /// Creates the row; the Home says where each shortcut goes.
  const new({
    required this.onPix,
    required this.onPay,
    required this.onReceive,
    super.key,
  });

  /// Opens the Pix area.
  final VoidCallback onPix;

  /// Opens the reading of a Pix QR Code.
  final VoidCallback onPay;

  /// Opens "Receber", with the customer's QR Code.
  final VoidCallback onReceive;

  /// One width for every tile (week 8 plan, V13).
  static const double tileWidth = 84;

  @override
  Widget build(BuildContext context) {
    void sayComingSoon() =>
        showNbToast(context, 'Em breve.', icon: Icons.info_outline);

    final shortcuts = [
      ActionTile(icon: const PixMark(), label: 'Área Pix', onPressed: onPix),
      ActionTile(
        icon: const Icon(Icons.qr_code_scanner),
        label: 'Pagar',
        onPressed: onPay,
      ),
      ActionTile(
        icon: const Icon(Icons.qr_code_2),
        label: 'Receber',
        onPressed: onReceive,
      ),
      ActionTile(
        icon: const Icon(Icons.swap_horiz),
        label: 'Transferir',
        onPressed: sayComingSoon,
      ),
      ActionTile(
        icon: const Icon(Icons.phone_android),
        label: 'Recarga',
        onPressed: sayComingSoon,
      ),
    ];

    // A sideways list needs a fixed height. It grows with the system's text
    // size, so larger labels still fit.
    final height = MediaQuery.textScalerOf(context).scale(ActionTile.height);

    return SizedBox(
      height: height,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: shortcuts.length,
        separatorBuilder: (_, _) => const SizedBox(width: NbSpace.sm),
        itemBuilder: (_, index) =>
            SizedBox(width: tileWidth, child: shortcuts[index]),
      ),
    );
  }
}
