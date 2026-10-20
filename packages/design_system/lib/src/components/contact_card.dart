import 'package:design_system/src/theme.dart';
import 'package:design_system/src/tokens.dart';
import 'package:flutter/material.dart';

/// Who receives a Pix (brief, section 7; pix-dark mockup): the initial, the
/// full name and the masked document. Selected, it has a mint border and a
/// check, so the state never depends on color alone (brief, section 8).
class ContactCard extends StatelessWidget {
  /// Creates the card.
  const new({
    required this.name,
    required this.detail,
    this.selected = true,
    super.key,
  });

  /// The payee's full name.
  final String name;

  /// What identifies the payee, e.g. "CPF ***.456.789-** · next bank".
  final String detail;

  /// True when this is the payee the Pix goes to.
  final bool selected;

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;
    return Semantics(
      container: true,
      selected: selected,
      label: '$name, $detail',
      excludeSemantics: true,
      child: Container(
        padding: const EdgeInsets.all(NbSpace.lg),
        decoration: BoxDecoration(
          color: colors.surface,
          borderRadius: BorderRadius.circular(NbRadius.box),
          border: Border.all(
            color: selected ? colors.accent : colors.border,
            width: selected ? 1.5 : 1,
          ),
        ),
        child: Row(
          children: [
            Container(
              width: NbSize.touch,
              height: NbSize.touch,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: colors.accent.withValues(alpha: 0.14),
                borderRadius: BorderRadius.circular(NbSpace.md),
              ),
              child: Text(
                name.isEmpty ? '' : name.characters.first.toUpperCase(),
                style: NbType.avatar.copyWith(color: colors.accent),
              ),
            ),
            const SizedBox(width: NbSpace.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    name,
                    style: NbType.bodyStrong.copyWith(color: colors.text),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    detail,
                    style: NbType.caption.copyWith(color: colors.textMuted),
                  ),
                ],
              ),
            ),
            if (selected) ...[
              const SizedBox(width: NbSpace.md),
              Container(
                width: 28,
                height: 28,
                decoration: BoxDecoration(
                  color: colors.accent,
                  shape: BoxShape.circle,
                ),
                child: Icon(Icons.check, size: 18, color: colors.background),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
