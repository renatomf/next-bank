import 'dart:async';

import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:next_bank/features/security/presentation/biometrics/biometrics_controller.dart';

/// "Usar biometria" in Security (v1.1.0 plan, task 2): shown only with
/// strong biometrics on the phone. Turning it on asks for the PIN, which the
/// server checks before it is kept (MOB-11).
class BiometricsTile extends ConsumerWidget {
  /// Creates the tile.
  const new({super.key});

  static const String _caption =
      'Abra o app com digital ou rosto e confirme Pix com a biometria';

  Future<void> _turnOn(BuildContext context, WidgetRef ref) async {
    final pin = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      builder: (sheet) => const _PinSheet(),
    );
    if (pin == null || !context.mounted) return;
    final enabled = await ref
        .read(biometricsControllerProvider.notifier)
        .enable(pin);
    if (!context.mounted) return;
    final state = ref.read(biometricsControllerProvider).value;
    showNbToast(
      context,
      enabled ? 'Biometria ativada.' : state?.error ?? 'Algo deu errado.',
      icon: enabled ? Icons.fingerprint : Icons.error_outline,
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(biometricsControllerProvider).value;
    if (state == null || !state.available) return const SizedBox.shrink();
    final colors = context.nbColors;
    void toggle() => state.enabled
        ? unawaited(ref.read(biometricsControllerProvider.notifier).disable())
        : unawaited(_turnOn(context, ref));
    return Padding(
      padding: const EdgeInsets.only(top: NbSpace.sm),
      child: Semantics(
        container: true,
        button: true,
        toggled: state.enabled,
        label: 'Usar biometria, $_caption',
        excludeSemantics: true,
        child: Material(
          color: colors.surface,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(NbRadius.box),
            side: BorderSide(color: colors.border),
          ),
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            onTap: state.saving ? null : toggle,
            child: Padding(
              padding: const EdgeInsets.all(NbSpace.lg),
              child: Row(
                children: [
                  Icon(Icons.fingerprint, color: colors.accent),
                  const SizedBox(width: NbSpace.md),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Usar biometria', style: context.nbText.bodyText),
                        const SizedBox(height: 2),
                        Text(_caption, style: context.nbText.caption),
                      ],
                    ),
                  ),
                  // The whole tile is the touch target, so the switch only
                  // shows the state.
                  NbSwitch(
                    value: state.enabled,
                    rowTakesTap: true,
                    onChanged: state.saving ? null : (_) => toggle(),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Asks for the PIN once, to keep it behind biometrics.
class _PinSheet extends StatefulWidget {
  const new();

  @override
  State<_PinSheet> createState() => _PinSheetState();
}

class _PinSheetState extends State<_PinSheet> {
  final _pin = TextEditingController();

  @override
  void dispose() {
    _pin.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Padding(
      padding: EdgeInsets.fromLTRB(
        NbSpace.screen,
        NbSpace.xl,
        NbSpace.screen,
        NbSpace.xl + MediaQuery.viewInsetsOf(context).bottom,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Semantics(
            header: true,
            child: Text('Confirme seu PIN', style: text.titleMedium),
          ),
          const SizedBox(height: NbSpace.sm),
          Text(
            'Ele fica guardado no aparelho, protegido pela sua biometria.',
            style: text.bodySmall,
          ),
          const SizedBox(height: NbSpace.lg),
          PinField(
            label: 'PIN de 4 dígitos',
            controller: _pin,
            onCompleted: (pin) => Navigator.of(context).pop(pin),
          ),
        ],
      ),
    );
  }
}
