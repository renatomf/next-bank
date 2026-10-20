import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:next_bank/features/recharge/domain/carrier.dart';

/// "Recargas": the phone carriers, each with its initials in place of its
/// logo, a third-party mark.
class CarrierList extends StatelessWidget {
  /// Creates the list; [onCarrier] gets the carrier tapped.
  const new({required this.onCarrier, super.key});

  /// Opens the recharge for a carrier.
  final ValueChanged<Carrier> onCarrier;

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Semantics(
          header: true,
          child: Text(
            'Recargas',
            style: NbType.sectionTitle.copyWith(color: colors.text),
          ),
        ),
        const SizedBox(height: NbSpace.sm),
        for (final carrier in phoneCarriers)
          _CarrierRow(carrier: carrier, onTap: () => onCarrier(carrier)),
      ],
    );
  }
}

class _CarrierRow extends StatelessWidget {
  const new({required this.carrier, required this.onTap});

  final Carrier carrier;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;

    return Semantics(
      container: true,
      button: true,
      label: carrier.name,
      onTap: onTap,
      excludeSemantics: true,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(NbRadius.boxInner),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: NbSpace.md),
          child: Row(
            spacing: NbSpace.lg,
            children: [
              InitialsAvatar(initials: carrier.initials),
              Expanded(
                child: Text(
                  carrier.name,
                  style: NbType.bodyText.copyWith(color: colors.text),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
