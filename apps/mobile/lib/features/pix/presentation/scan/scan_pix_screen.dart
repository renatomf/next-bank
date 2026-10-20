import 'dart:async';

import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:next_bank/core/scan/qr_scanner.dart';
import 'package:next_bank/features/pix/presentation/send/send_pix_controller.dart';

/// Paying by QR Code (v1.1.0 plan, task 4), from the Home's "Pagar": the
/// camera, open with the screen, or the "Copia e Cola" pasted. A valid code
/// fills the Pix screen beneath and goes back to it; nothing read ever opens
/// a link or another screen (MOB-06).
class ScanPixScreen extends ConsumerStatefulWidget {
  /// Creates the screen; the router says where back and a read code go.
  const new({required this.onBack, required this.onRead, super.key});

  /// Leaves without a code.
  final VoidCallback onBack;

  /// Back to the Pix, filled with the code read.
  final VoidCallback onRead;

  @override
  ConsumerState<ScanPixScreen> createState() => _ScanPixScreenState();
}

class _ScanPixScreenState extends ConsumerState<ScanPixScreen> {
  String? _error;
  bool _cameraDenied = false;
  bool _done = false;

  Future<void> _read(String text) async {
    if (_done) return;
    final error = await ref
        .read(sendPixControllerProvider.notifier)
        .readQrCode(text);
    if (!mounted || _done) return;
    if (error == null) {
      _done = true;
      widget.onRead();
    } else if (error != _error) {
      setState(() => _error = error);
    }
  }

  Future<void> _paste() async {
    final data = await Clipboard.getData(Clipboard.kTextPlain);
    await _read(data?.text ?? '');
  }

  @override
  Widget build(BuildContext context) {
    final scanner = ref.watch(qrScannerProvider);
    final text = Theme.of(context).textTheme;
    final error = _error;
    return Scaffold(
      body: GlowBackground(
        child: SafeArea(
          child: ListView(
            padding: const EdgeInsets.all(NbSpace.screen),
            children: [
              ScreenHeader(
                title: 'Pagar',
                icon: Icons.arrow_back,
                iconLabel: 'Voltar',
                onPressed: widget.onBack,
              ),
              const SizedBox(height: NbSpace.xl),
              if (_cameraDenied)
                const InfoNotice(
                  message:
                      'Sem acesso à câmera. Você pode colar o código '
                      'Copia e Cola.',
                )
              else ...[
                ClipRRect(
                  borderRadius: BorderRadius.circular(NbRadius.box),
                  child: AspectRatio(
                    aspectRatio: 1,
                    child: scanner(
                      onCode: (code) => unawaited(_read(code)),
                      onCameraDenied: () {
                        if (mounted) setState(() => _cameraDenied = true);
                      },
                    ),
                  ),
                ),
                const SizedBox(height: NbSpace.lg),
                Text(
                  'Aponte a câmera para o QR Code do Pix.',
                  textAlign: TextAlign.center,
                  style: text.bodyMedium,
                ),
              ],
              if (error != null) ...[
                const SizedBox(height: NbSpace.lg),
                FormErrorText(error),
              ],
              const SizedBox(height: NbSpace.xl),
              SecondaryButton(
                label: 'Colar Copia e Cola',
                onPressed: () => unawaited(_paste()),
              ),
              const SizedBox(height: NbSpace.lg),
              const SecureHint(text: 'Você confere quem recebe antes de pagar'),
            ],
          ),
        ),
      ),
    );
  }
}
