import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';

/// Pix Automático and Minhas chaves, in one row split by a line.
class PixLinks extends StatelessWidget {
  /// Creates the links; the box says where each one goes.
  const new({required this.onAutomatic, required this.onKeys, super.key});

  /// Opens "Pix Automático".
  final VoidCallback onAutomatic;

  /// Opens "Minhas chaves".
  final VoidCallback onKeys;

  @override
  Widget build(BuildContext context) {
    // IntrinsicHeight lets the divider run the height of the links.
    return IntrinsicHeight(
      child: Row(
        children: [
          Expanded(
            child: _PixLink(
              icon: const PixMark(size: NbSize.icon),
              text: 'Pix\nAutomático',
              onPressed: onAutomatic,
            ),
          ),
          VerticalDivider(
            width: 1,
            indent: NbSpace.sm,
            endIndent: NbSpace.sm,
            color: context.nbColors.border,
          ),
          Expanded(
            child: _PixLink(
              // A little in from the edge, at the developer's request.
              icon: const Padding(
                padding: EdgeInsets.only(left: NbSpace.sm),
                child: Icon(Icons.key_outlined, size: NbSize.icon),
              ),
              text: 'Minhas\nchaves',
              onPressed: onKeys,
            ),
          ),
        ],
      ),
    );
  }
}

/// The icon on the start edge and the two-line text centered in the room
/// beside it, as in the reference. On a narrow link the text shrinks
/// instead of breaking a word in the middle.
class _PixLink extends StatelessWidget {
  const new({required this.icon, required this.text, required this.onPressed});

  final Widget icon;
  final String text;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;

    return Semantics(
      button: true,
      // Read as one phrase: "Minhas chaves", not two lines.
      label: text.replaceAll('\n', ' '),
      excludeSemantics: true,
      child: InkWell(
        onTap: onPressed,
        borderRadius: BorderRadius.circular(NbRadius.boxInner),
        child: Padding(
          padding: const EdgeInsets.all(NbSpace.sm),
          child: Row(
            children: [
              IconTheme.merge(
                data: IconThemeData(color: colors.accent),
                child: icon,
              ),
              Expanded(
                child: FittedBox(
                  fit: BoxFit.scaleDown,
                  child: Text(
                    text,
                    textAlign: TextAlign.center,
                    style: NbType.caption.copyWith(color: colors.accent),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
