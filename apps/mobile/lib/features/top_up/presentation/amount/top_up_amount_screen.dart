import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:next_bank/features/top_up/domain/phone_number.dart';
import 'package:next_bank/features/top_up/domain/top_up.dart';
import 'package:next_bank/features/top_up/presentation/confirm/confirm_top_up_controller.dart';

/// The number and the amount of a top-up (v1.1.0 plan, task 5b). Only a
/// made-up number is taken, and the screen says so before any call
/// (TOP-01); the amounts are the operator's, as the server sent them (D6).
class TopUpAmountScreen extends StatefulWidget {
  /// Creates the screen for [operator].
  const new({
    required this.operator,
    required this.onBack,
    required this.onContinue,
    super.key,
  });

  /// Where the top-up goes.
  final TopUpOperator operator;

  /// Leaves the screen.
  final VoidCallback onBack;

  /// Goes to the confirmation with what was chosen.
  final ValueChanged<TopUpDraft> onContinue;

  @override
  State<TopUpAmountScreen> createState() => _TopUpAmountScreenState();
}

/// What the customer is told under the number, always (TOP-01, DEMO-01).
const String fictitiousNumberNotice =
    'Use um número fictício, como (11) 90000-0001: nenhuma linha de verdade '
    'é recarregada.';

class _TopUpAmountScreenState extends State<TopUpAmountScreen> {
  final _phone = TextEditingController();

  /// The amount picked, in cents; none at first.
  int? _pickedCents;

  /// Shown under the number after "Continuar" with one not taken.
  String? _phoneError;

  @override
  void dispose() {
    _phone.dispose();
    super.dispose();
  }

  void _continue(int pickedCents) {
    final phone = PhoneNumber.parse(_phone.text);
    if (phone == null) {
      setState(() => _phoneError = 'Use um número fictício: (DD) 90000-XXXX.');
      return;
    }
    final operator = widget.operator;
    widget.onContinue((
      operator: (
        id: operator.id,
        name: operator.name,
        initials: operator.initials,
      ),
      phoneDigits: phone.digits,
      phoneMasked: phone.masked,
      amountCents: pickedCents,
    ));
  }

  @override
  Widget build(BuildContext context) {
    final operator = widget.operator;
    final pickedCents = _pickedCents;

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
                        InitialsAvatar(initials: operator.initials),
                        Expanded(
                          child: Text(
                            'Recarga de celular ${operator.name}',
                            style: context.nbText.bodyText,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: NbSpace.xl),
                    NbTextField(
                      label: 'Número do celular',
                      controller: _phone,
                      errorText: _phoneError,
                      keyboardType: TextInputType.phone,
                      inputFormatters: [
                        FilteringTextInputFormatter.allow(RegExp('[0-9 ()-]')),
                        LengthLimitingTextInputFormatter(16),
                      ],
                      onChanged: (_) {
                        if (_phoneError != null) {
                          setState(() => _phoneError = null);
                        }
                      },
                    ),
                    const SizedBox(height: NbSpace.md),
                    const InfoNotice(message: fictitiousNumberNotice),
                    const SizedBox(height: NbSpace.xl),
                    Text('Valor da recarga', style: context.nbText.bodyText),
                    const SizedBox(height: NbSpace.md),
                    NbGrid(
                      children: [
                        for (final cents in operator.amountsCents)
                          FilterPill(
                            label: 'R\$ ${formatReais(cents).integer}',
                            selected: cents == pickedCents,
                            onPressed: () =>
                                setState(() => _pickedCents = cents),
                          ),
                      ],
                    ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(NbSpace.screen),
                child: PrimaryButton(
                  label: 'Continuar',
                  onPressed: pickedCents == null
                      ? null
                      : () => _continue(pickedCents),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
