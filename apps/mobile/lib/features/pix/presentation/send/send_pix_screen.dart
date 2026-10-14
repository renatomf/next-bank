import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:next_bank/core/account/account_providers.dart';
import 'package:next_bank/core/cpf_input_formatter.dart';
import 'package:next_bank/features/pix/domain/pix_amount.dart';
import 'package:next_bank/features/pix/presentation/pix_formats.dart';
import 'package:next_bank/features/pix/presentation/send/send_pix_controller.dart';

/// Sending a Pix (screen 7; pix-dark mockup, without the tabs, the recent
/// contacts and the support button, decision D8): the amount, who receives
/// by CPF key, an optional description, then the review with the PIN.
class SendPixScreen extends ConsumerStatefulWidget {
  /// Creates the screen; the router says where back and the review go.
  const new({
    required this.onBack,
    required this.onReceive,
    required this.onReview,
    super.key,
  });

  /// Leaves the Pix.
  final VoidCallback onBack;

  /// Opens "Receber", with the QR Code (v1.1.0 plan, task 3).
  final VoidCallback onReceive;

  /// Opens the review of the Pix just created.
  final ValueChanged<String> onReview;

  @override
  ConsumerState<SendPixScreen> createState() => _SendPixScreenState();
}

class _SendPixScreenState extends ConsumerState<SendPixScreen> {
  final _amount = FocusNode();

  @override
  void dispose() {
    _amount.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final transferId = await ref
        .read(sendPixControllerProvider.notifier)
        .submit();
    if (transferId != null && mounted) widget.onReview(transferId);
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(sendPixControllerProvider);
    final controller = ref.read(sendPixControllerProvider.notifier);
    final account = ref.watch(accountProvider).value;
    final hidden = ref.watch(balanceHiddenProvider);
    final payee = state.payee;
    final error = state.error;
    final text = Theme.of(context).textTheme;
    return Scaffold(
      body: GlowBackground(
        child: SafeArea(
          child: ListView(
            padding: const EdgeInsets.all(NbSpace.screen),
            children: [
              ScreenHeader(
                title: 'Pix',
                icon: Icons.arrow_back,
                iconLabel: 'Voltar',
                onPressed: widget.onBack,
                // The same choice as the Home's eye (MOB-05).
                action: IconCircleButton(
                  icon: hidden
                      ? Icons.visibility_off_outlined
                      : Icons.visibility_outlined,
                  label: hidden ? 'Mostrar saldo' : 'Ocultar saldo',
                  onPressed: ref.read(balanceHiddenProvider.notifier).toggle,
                ),
              ),
              Align(
                alignment: Alignment.centerRight,
                child: TextButton.icon(
                  onPressed: widget.onReceive,
                  icon: const Icon(Icons.qr_code_2, size: 20),
                  label: const Text('Receber'),
                ),
              ),
              const SizedBox(height: NbSpace.sm),
              Stack(
                children: [
                  // The amount is typed on the keyboard into this field and
                  // shown by the card, as on an ATM: right to left.
                  Positioned.fill(
                    child: Opacity(
                      opacity: 0,
                      // Still announced: a screen reader types the amount here.
                      alwaysIncludeSemantics: true,
                      child: TextField(
                        focusNode: _amount,
                        autofocus: true,
                        keyboardType: TextInputType.number,
                        inputFormatters: [
                          FilteringTextInputFormatter.digitsOnly,
                          LengthLimitingTextInputFormatter(maxAmountDigits),
                        ],
                        decoration: const InputDecoration(
                          labelText: 'Valor do Pix',
                        ),
                        onChanged: controller.typeAmount,
                      ),
                    ),
                  ),
                  AmountCard(
                    cents: state.amountCents,
                    balanceCents: account?.availableBalanceCents,
                    balanceHidden: hidden,
                    onEdit: _amount.requestFocus,
                  ),
                ],
              ),
              const SizedBox(height: NbSpace.xl),
              Row(
                children: [
                  Expanded(child: Text('Para quem?', style: text.titleMedium)),
                  TextButton.icon(
                    onPressed: state.searching ? null : controller.lookup,
                    iconAlignment: IconAlignment.end,
                    icon: const Icon(Icons.search, size: 20),
                    label: const Text('Buscar chave'),
                  ),
                ],
              ),
              const SizedBox(height: NbSpace.sm),
              NbTextField(
                label: 'Chave CPF',
                keyboardType: TextInputType.number,
                textInputAction: TextInputAction.search,
                // Digits only; the mask shows as they are typed (v1.1.0
                // plan, task 1.1).
                inputFormatters: const [CpfInputFormatter()],
                errorText: state.keyError,
                onChanged: controller.typeKey,
                onSubmitted: (_) => controller.lookup(),
              ),
              if (state.searching) ...[
                const SizedBox(height: NbSpace.lg),
                const Center(
                  child: CircularProgressIndicator(
                    semanticsLabel: 'Buscando a chave',
                  ),
                ),
              ],
              if (payee != null) ...[
                const SizedBox(height: NbSpace.lg),
                ContactCard(name: payee.name, detail: payeeDetail(payee)),
              ],
              const SizedBox(height: NbSpace.xl),
              NbTextField(
                label: 'Descrição (opcional)',
                textInputAction: TextInputAction.done,
                inputFormatters: [
                  LengthLimitingTextInputFormatter(maxDescriptionLength),
                ],
                onChanged: controller.typeDescription,
              ),
              if (error != null) ...[
                const SizedBox(height: NbSpace.lg),
                FormErrorText(error),
              ],
              const SizedBox(height: NbSpace.xl),
              PrimaryButton(
                label: 'Revisar Pix',
                onPressed: state.canSubmit ? _submit : null,
                loading: state.submitting,
              ),
              const SizedBox(height: NbSpace.lg),
              const SecureHint(
                text: 'Você confirma com seu PIN antes de enviar',
              ),
            ],
          ),
        ),
      ),
    );
  }
}
