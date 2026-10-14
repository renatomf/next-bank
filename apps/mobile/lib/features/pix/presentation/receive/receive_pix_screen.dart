import 'dart:async';

import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:next_bank/core/share/text_sharer.dart';
import 'package:next_bank/features/pix/domain/br_code.dart';
import 'package:next_bank/features/pix/domain/pix_amount.dart';
import 'package:next_bank/features/pix/presentation/receive/receive_pix_controller.dart';

/// Receiving a Pix (v1.1.0 plan, task 3): the QR Code of the customer's
/// random key, with an optional amount and message, and its "Copia e Cola"
/// to copy or share. Never the CPF (PIX-12).
class ReceivePixScreen extends ConsumerStatefulWidget {
  /// Creates the screen; the router says where back goes.
  const new({required this.onBack, super.key});

  /// Leaves the screen.
  final VoidCallback onBack;

  @override
  ConsumerState<ReceivePixScreen> createState() => _ReceivePixScreenState();
}

class _ReceivePixScreenState extends ConsumerState<ReceivePixScreen> {
  @override
  void initState() {
    super.initState();
    // After the first frame's build: a provider cannot change during it.
    unawaited(
      Future.microtask(
        () => ref.read(receivePixControllerProvider.notifier).load(),
      ),
    );
  }

  Future<void> _copy(String code) async {
    await Clipboard.setData(ClipboardData(text: code));
    if (!mounted) return;
    showNbToast(context, 'Código copiado.', icon: Icons.check_circle_outline);
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(receivePixControllerProvider);
    final controller = ref.read(receivePixControllerProvider.notifier);
    final code = state.code;
    final error = state.error;
    final text = Theme.of(context).textTheme;
    return Scaffold(
      body: GlowBackground(
        child: SafeArea(
          child: ListView(
            padding: const EdgeInsets.all(NbSpace.screen),
            children: [
              ScreenHeader(
                title: 'Receber Pix',
                icon: Icons.arrow_back,
                iconLabel: 'Voltar',
                onPressed: widget.onBack,
              ),
              const SizedBox(height: NbSpace.xl),
              if (state.loading)
                const Center(
                  child: CircularProgressIndicator(
                    semanticsLabel: 'Carregando sua chave',
                  ),
                )
              else if (error != null)
                ErrorState(message: error, onRetry: controller.load)
              else if (code != null) ...[
                Center(
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(NbRadius.block),
                    child: QrCodeView(
                      data: code,
                      semanticLabel: 'QR Code para receber o Pix',
                    ),
                  ),
                ),
                const SizedBox(height: NbSpace.lg),
                Text(
                  'Chave aleatória',
                  textAlign: TextAlign.center,
                  style: text.labelLarge,
                ),
                Text(
                  state.keyMasked ?? '',
                  textAlign: TextAlign.center,
                  style: text.bodyMedium,
                ),
                if (state.amountCents > 0) ...[
                  const SizedBox(height: NbSpace.sm),
                  Center(child: MoneyText(cents: state.amountCents)),
                ],
                const SizedBox(height: NbSpace.xl),
                NbTextField(
                  label: 'Valor (opcional)',
                  keyboardType: TextInputType.number,
                  textInputAction: TextInputAction.next,
                  inputFormatters: [
                    FilteringTextInputFormatter.digitsOnly,
                    LengthLimitingTextInputFormatter(maxAmountDigits),
                  ],
                  onChanged: controller.typeAmount,
                ),
                const SizedBox(height: NbSpace.lg),
                NbTextField(
                  label: 'Mensagem (opcional)',
                  textInputAction: TextInputAction.done,
                  inputFormatters: [
                    LengthLimitingTextInputFormatter(maxBrCodeMessageLength),
                  ],
                  onChanged: controller.typeMessage,
                ),
                const SizedBox(height: NbSpace.xl),
                PrimaryButton(
                  label: 'Copiar código',
                  onPressed: () => unawaited(_copy(code)),
                ),
                const SizedBox(height: NbSpace.md),
                SecondaryButton(
                  label: 'Compartilhar',
                  onPressed: () =>
                      unawaited(ref.read(textSharerProvider).shareText(code)),
                ),
                const SizedBox(height: NbSpace.lg),
                const SecureHint(
                  text: 'O QR Code leva sua chave aleatória, nunca o seu CPF',
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
