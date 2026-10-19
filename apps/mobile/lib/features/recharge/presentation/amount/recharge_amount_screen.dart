import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:next_bank/features/recharge/domain/carrier.dart';

/// The amount of a recharge (v1.1.0 plan, task 4.12), layout only for now:
/// the carrier, the number and the amounts, one picked at a time.
/// "Continuar" says it is coming; no recharge happens.
class RechargeAmountScreen extends StatefulWidget {
  /// Creates the screen for [carrier] and [phone].
  const new({
    required this.carrier,
    required this.phone,
    required this.onBack,
    super.key,
  });

  /// The carrier of the recharge.
  final Carrier carrier;

  /// The number to recharge.
  final String phone;

  /// Leaves the screen.
  final VoidCallback onBack;

  @override
  State<RechargeAmountScreen> createState() => _RechargeAmountScreenState();
}

class _RechargeAmountScreenState extends State<RechargeAmountScreen> {
  /// The amount picked, in cents; none at first.
  int? _pickedCents;

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;
    final carrier = widget.carrier;

    return Scaffold(
      body: GlowBackground(
        child: SafeArea(
          child: Column(
            children: [
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.all(NbSpace.screen),
                  children: [
                    ScreenHeader(
                      title: 'Recargas',
                      icon: Icons.arrow_back,
                      iconLabel: 'Voltar',
                      onPressed: widget.onBack,
                    ),
                    const SizedBox(height: NbSpace.xl),
                    Row(
                      spacing: NbSpace.md,
                      children: [
                        InitialsAvatar(initials: carrier.initials),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                carrier.name,
                                style: NbType.caption.copyWith(
                                  color: colors.textMuted,
                                ),
                              ),
                              Text(
                                'Recarga de celular ${carrier.name}',
                                style: NbType.bodyText.copyWith(
                                  color: colors.text,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: NbSpace.xl),
                    Text(
                      'Escolha o valor da recarga para ${widget.phone}',
                      style: NbType.screenTitle.copyWith(color: colors.text),
                    ),
                    const SizedBox(height: NbSpace.xl),
                    Text(
                      'Valor da recarga',
                      style: NbType.bodyText.copyWith(color: colors.text),
                    ),
                    const SizedBox(height: NbSpace.md),
                    _AmountGrid(
                      pickedCents: _pickedCents,
                      onPicked: (cents) => setState(() => _pickedCents = cents),
                    ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(NbSpace.screen),
                child: PrimaryButton(
                  label: 'Continuar',
                  onPressed: () => showNbToast(
                    context,
                    'Em breve.',
                    icon: Icons.info_outline,
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

/// The amounts three to a row, as the reference; the one picked is on.
class _AmountGrid extends StatelessWidget {
  const new({required this.pickedCents, required this.onPicked});

  final int? pickedCents;
  final ValueChanged<int> onPicked;

  static const int _perRow = 3;

  @override
  Widget build(BuildContext context) {
    const amounts = rechargeAmountsInCents;
    return Column(
      spacing: NbSpace.sm,
      children: [
        for (var start = 0; start < amounts.length; start += _perRow)
          Row(
            spacing: NbSpace.sm,
            children: [
              for (var i = start; i < start + _perRow; i++)
                Expanded(
                  // A short last row keeps the columns of the others.
                  child: i < amounts.length
                      ? FilterPill(
                          label: 'R\$ ${formatReais(amounts[i]).integer}',
                          selected: amounts[i] == pickedCents,
                          onPressed: () => onPicked(amounts[i]),
                        )
                      : const SizedBox.shrink(),
                ),
            ],
          ),
      ],
    );
  }
}
