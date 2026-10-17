import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:next_bank/features/home/presentation/pix_box/pix_box.dart';

/// The three main Pix actions side by side, split by thin lines: Transferir
/// Pix, Pagar QR Code and Gerar QR Code.
class PixActions extends StatelessWidget {
  /// Creates the actions; the box says where each one goes.
  const new({
    required this.onTransfer,
    required this.onPay,
    required this.onReceive,
    super.key,
  });

  /// Opens "Transferir Pix".
  final VoidCallback onTransfer;

  /// Opens the reading of a Pix QR Code.
  final VoidCallback onPay;

  /// Opens "Receber", with the customer's QR Code.
  final VoidCallback onReceive;

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;

    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.surface2,
        borderRadius: BorderRadius.circular(NbRadius.boxInner),
      ),
      child: IntrinsicHeight(
        child: Row(
          children: [
            Expanded(
              child: _PixActionButton(
                icon: Icons.swap_horiz,
                label: 'Transferir Pix',
                text: 'Transferir\nPix',
                onPressed: onTransfer,
              ),
            ),
            const _ActionDivider(),
            Expanded(
              child: _PixActionButton(
                icon: Icons.qr_code_scanner,
                label: 'Pagar QR Code',
                text: 'Pagar\nQR Code',
                onPressed: onPay,
              ),
            ),
            const _ActionDivider(),
            Expanded(
              child: _PixActionButton(
                icon: Icons.qr_code_2,
                label: 'Gerar QR Code',
                text: 'Gerar\nQR Code',
                onPressed: onReceive,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// An icon over a two-line text, read by screen readers as one [label].
class _PixActionButton extends StatelessWidget {
  const new({
    required this.icon,
    required this.label,
    required this.text,
    required this.onPressed,
  });

  final IconData icon;
  final String label;
  final String text;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;

    return Semantics(
      button: true,
      label: label,
      excludeSemantics: true,
      child: InkWell(
        onTap: onPressed,
        borderRadius: BorderRadius.circular(NbRadius.boxInner),
        child: Padding(
          padding: const EdgeInsets.symmetric(
            vertical: NbSpace.md,
            horizontal: NbSpace.xs,
          ),
          child: Column(
            children: [
              Icon(icon, size: pixBoxIconSize, color: colors.accent),
              const SizedBox(height: NbSpace.xs),
              Text(
                text,
                textAlign: TextAlign.center,
                style: NbType.caption.copyWith(color: colors.text),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ActionDivider extends StatelessWidget {
  const new();

  @override
  Widget build(BuildContext context) => VerticalDivider(
    width: 1,
    indent: NbSpace.md,
    endIndent: NbSpace.md,
    color: context.nbColors.border,
  );
}
