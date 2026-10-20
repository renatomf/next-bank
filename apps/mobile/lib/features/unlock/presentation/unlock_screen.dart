import 'dart:async';

import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:next_bank/core/session/biometric_pin_store.dart';
import 'package:next_bank/core/session/greeting_name_store.dart';
import 'package:next_bank/core/ui/common_copy.dart';
import 'package:next_bank/features/unlock/presentation/unlock_controller.dart';

/// The Unlock screen (screen 5; F-16; v1.1.0 plan, task 2): what the
/// customer sees when the app opens with a stored session and after 5
/// minutes away. The green glass art fills the screen and fades into the
/// background, under the logo, the first-name greeting (MOB-12) and either
/// "Acessar conta" with biometrics or the PIN.
class UnlockScreen extends ConsumerStatefulWidget {
  /// Creates the screen; [otherAccount] comes from the router, so features
  /// do not import each other.
  const new({this.otherAccount, super.key});

  /// "Entrar com outra conta", which ends this session.
  final Widget? otherAccount;

  @override
  ConsumerState<UnlockScreen> createState() => _UnlockScreenState();
}

class _UnlockScreenState extends ConsumerState<UnlockScreen> {
  final _pin = TextEditingController();

  // The customer chose "Usar PIN", or biometrics did not unlock.
  bool _typing = false;

  @override
  void dispose() {
    _pin.dispose();
    super.dispose();
  }

  void _onCompleted(String pin) {
    _pin.clear();
    // The controller reports progress and errors through its state.
    unawaited(ref.read(unlockControllerProvider.notifier).submit(pin));
  }

  Future<void> _useBiometrics() async {
    await ref.read(unlockControllerProvider.notifier).useBiometrics();
    // Still here: cancelled, or the kept PIN is gone. The PIN is left.
    if (mounted) setState(() => _typing = true);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;
    final name = ref.watch(greetingNameProvider).value;
    final biometrics = ref.watch(biometricUnlockProvider).value ?? false;
    return Scaffold(
      backgroundColor: colors.background,
      body: Stack(
        fit: StackFit.expand,
        children: [
          const GlassArt(),
          // The art fades into the background, so the text below reads on
          // a plain color in both themes.
          DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  colors.background.withValues(alpha: 0),
                  colors.background.withValues(alpha: 0),
                  colors.background.withValues(alpha: 0.85),
                  colors.background,
                ],
                stops: const [0, 0.3, 0.55, 0.7],
              ),
            ),
          ),
          SafeArea(
            child: LayoutBuilder(
              builder: (context, constraints) => SingleChildScrollView(
                padding: const EdgeInsets.all(NbSpace.screen),
                child: ConstrainedBox(
                  constraints: BoxConstraints(
                    minHeight: constraints.maxHeight - NbSpace.screen * 2,
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.end,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const Align(
                        alignment: Alignment.centerLeft,
                        child: NextLogo(size: 28),
                      ),
                      const SizedBox(height: NbSpace.xl),
                      Semantics(
                        header: true,
                        child: Text(
                          name == null ? 'Olá!' : 'Olá, $name',
                          style: Theme.of(context).textTheme.displayLarge,
                        ),
                      ),
                      const SizedBox(height: NbSpace.sm),
                      Text(
                        'Seu dinheiro, um passo à frente.',
                        style: context.nbText.bodyText.copyWith(
                          color: colors.textMuted,
                        ),
                      ),
                      const SizedBox(height: NbSpace.xxl),
                      if (biometrics && !_typing)
                        ..._biometricAccess()
                      else
                        ..._pinAccess(),
                      if (widget.otherAccount case final otherAccount?) ...[
                        const SizedBox(height: NbSpace.sm),
                        Center(child: otherAccount),
                      ],
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  List<Widget> _biometricAccess() {
    final state = ref.watch(unlockControllerProvider);
    return [
      PrimaryButton(
        label: 'Acessar conta',
        loading: state.verifying,
        onPressed: _useBiometrics,
      ),
      const SizedBox(height: NbSpace.md),
      SecondaryButton(
        label: 'Usar PIN',
        onPressed: state.verifying
            ? null
            : () => setState(() => _typing = true),
      ),
    ];
  }

  List<Widget> _pinAccess() {
    final state = ref.watch(unlockControllerProvider);
    return [
      Text(
        'Digite seu PIN para acessar a conta.',
        style: context.nbText.caption,
      ),
      const SizedBox(height: NbSpace.lg),
      if (state.blocked)
        // Nothing left to type: the message says why, leaving says how.
        InfoNotice(message: state.error ?? '')
      else
        PinField(
          revealLabels: CommonCopy.revealSecret,
          label: 'PIN de 4 dígitos',
          controller: _pin,
          errorText: state.error,
          onCompleted: _onCompleted,
          enabled: !state.verifying,
        ),
      if (state.verifying) ...[
        const SizedBox(height: NbSpace.xl),
        const Center(
          child: CircularProgressIndicator(
            semanticsLabel: 'Conferindo seu PIN',
          ),
        ),
      ],
    ];
  }
}
