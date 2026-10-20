import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';

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
    const divider = VerticalDivider(indent: NbSpace.md, endIndent: NbSpace.md);

    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.surface2,
        borderRadius: BorderRadius.circular(NbRadius.boxInner),
      ),
      // IntrinsicHeight lets the dividers run the height of the buttons.
      child: IntrinsicHeight(
        child: Row(
          children: [
            Expanded(
              child: _PixAction(
                icon: Icons.swap_horiz,
                text: 'Transferir\nPix',
                onPressed: onTransfer,
              ),
            ),
            divider,
            Expanded(
              child: _PixAction(
                icon: Icons.qr_code_scanner,
                text: 'Pagar\nQR Code',
                onPressed: onPay,
              ),
            ),
            divider,
            Expanded(
              child: _PixAction(
                icon: Icons.qr_code_2,
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

/// An icon over a two-line text. The lines are the developer's call; on a
/// narrow column the text shrinks instead of breaking a word in the middle.
class _PixAction extends StatelessWidget {
  const new({required this.icon, required this.text, required this.onPressed});

  final IconData icon;
  final String text;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;

    return Semantics(
      button: true,
      // Read as one phrase: "Transferir Pix", not two lines.
      label: text.replaceAll('\n', ' '),
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
              Icon(icon, size: NbSize.icon, color: colors.accent),
              const SizedBox(height: NbSpace.xs),
              FittedBox(
                fit: BoxFit.scaleDown,
                child: Text(
                  text,
                  textAlign: TextAlign.center,
                  style: context.nbText.caption.copyWith(color: colors.text),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
