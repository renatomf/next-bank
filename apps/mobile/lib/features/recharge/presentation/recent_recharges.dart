import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:next_bank/features/recharge/domain/carrier.dart';
import 'package:next_bank/features/recharge/presentation/example_recharges.dart';

/// "Recargas recentes": a card per recent recharge, scrolling sideways,
/// then "Ver todos", which says it is coming for now.
class RecentRecharges extends StatelessWidget {
  /// Creates the cards; [onRecent] gets the carrier and number tapped.
  const new({required this.onRecent, super.key});

  /// Opens a recent recharge again.
  final void Function(Carrier carrier, String phone) onRecent;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      // Every card as tall as the tallest.
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          spacing: NbSpace.sm,
          children: [
            for (final recent in exampleRecentRecharges)
              if (carrierById(recent.carrierId) case final carrier?)
                _RecentCard(
                  label: '${carrier.name}, ${recent.phone}',
                  onTap: () => onRecent(carrier, recent.phone),
                  children: [
                    InitialsAvatar(initials: carrier.initials),
                    _CardText(carrier.name, muted: true),
                    _CardText(recent.phone),
                  ],
                ),
            _RecentCard(
              label: 'Ver todos',
              onTap: () =>
                  showNbToast(context, 'Em breve.', icon: Icons.info_outline),
              children: [
                Icon(
                  Icons.add_circle_outline,
                  size: 40,
                  color: context.nbColors.accent,
                ),
                const _CardText('Ver todos'),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _RecentCard extends StatelessWidget {
  const new({required this.label, required this.onTap, required this.children});

  final String label;
  final VoidCallback onTap;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;

    return Semantics(
      container: true,
      button: true,
      label: label,
      onTap: onTap,
      excludeSemantics: true,
      child: Material(
        color: colors.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(NbRadius.box),
          side: BorderSide(color: colors.border),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Container(
            width: 136,
            padding: const EdgeInsets.all(NbSpace.lg),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              spacing: NbSpace.sm,
              children: children,
            ),
          ),
        ),
      ),
    );
  }
}

class _CardText extends StatelessWidget {
  const new(this.text, {this.muted = false});

  final String text;
  final bool muted;

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;

    return Text(
      text,
      textAlign: TextAlign.center,
      style: NbType.caption.copyWith(
        color: muted ? colors.textMuted : colors.text,
      ),
    );
  }
}
