import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:next_bank/features/recharge/domain/carrier.dart';
import 'package:next_bank/features/recharge/presentation/carrier_list.dart';
import 'package:next_bank/features/recharge/presentation/example_recharges.dart';
import 'package:next_bank/features/recharge/presentation/recent_recharges.dart';

/// Recargas (v1.1.0 plan, task 4.12), layout only for now: the recent
/// recharges and the phone carriers, each opening the amount choice. Task 5
/// wires them to the server.
class RechargeScreen extends StatelessWidget {
  /// Creates the screen; the router says where back and a carrier go.
  const new({required this.onBack, required this.onCarrier, super.key});

  /// Leaves the screen.
  final VoidCallback onBack;

  /// Opens the amount choice for a carrier and a number.
  final void Function(Carrier carrier, String phone) onCarrier;

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;

    return Scaffold(
      body: GlowBackground(
        child: SafeArea(
          child: ListView(
            padding: const EdgeInsets.all(NbSpace.screen),
            children: [
              ScreenHeader(
                title: 'Recargas',
                icon: Icons.arrow_back,
                iconLabel: 'Voltar',
                onPressed: onBack,
              ),
              const SizedBox(height: NbSpace.xl),
              Semantics(
                header: true,
                child: Text(
                  'Recargas recentes',
                  style: NbType.sectionTitle.copyWith(color: colors.text),
                ),
              ),
              const SizedBox(height: NbSpace.md),
              RecentRecharges(onRecent: onCarrier),
              const SizedBox(height: NbSpace.xl),
              // The customer's own number, made up until task 5.
              CarrierList(
                onCarrier: (carrier) => onCarrier(carrier, examplePhone),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
