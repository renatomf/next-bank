import 'dart:async';

import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:next_bank/core/session/after_unlock.dart';
import 'package:next_bank/core/session/biometric_pin_store.dart';
import 'package:next_bank/core/session/greeting_name_store.dart';
import 'package:next_bank/features/unlock/presentation/unlock_controller.dart';

/// A shortcut on the Unlock screen: its screen opens once the app is
/// unlocked; without a route it says "Em breve.".
typedef UnlockShortcut = ({Widget icon, String label, String? route});

/// The Unlock screen (screen 5; F-16; v1.1.0 plan, task 2): what the
/// customer sees when the app opens with a stored session and after 5
/// minutes away. Laid out like a bank's sign-in: the logo, the brand glow,
/// and a card with the first-name greeting (MOB-12), shortcuts, and either
/// "Acessar conta" with biometrics or the PIN.
class UnlockScreen extends ConsumerStatefulWidget {
  /// Creates the screen; [shortcuts] and [otherAccount] come from the
  /// router, so features do not import each other.
  const new({this.shortcuts = const [], this.otherAccount, super.key});

  /// Shortcuts whose screens open once unlocked.
  final List<UnlockShortcut> shortcuts;

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

  void _open(UnlockShortcut shortcut) {
    final route = shortcut.route;
    if (route == null) {
      showNbToast(context, 'Em breve.', icon: Icons.info_outline);
      return;
    }
    ref.read(afterUnlockProvider.notifier).route = route;
    // With biometrics on, the shortcut asks for them at once.
    if (!_typing && (ref.read(biometricUnlockProvider).value ?? false)) {
      unawaited(_useBiometrics());
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;
    final text = Theme.of(context).textTheme;
    final name = ref.watch(greetingNameProvider).value;
    final biometrics = ref.watch(biometricUnlockProvider).value ?? false;
    return Scaffold(
      body: GlowBackground(
        child: SafeArea(
          child: LayoutBuilder(
            builder: (context, constraints) => SingleChildScrollView(
              padding: const EdgeInsets.all(NbSpace.screen),
              child: ConstrainedBox(
                constraints: BoxConstraints(
                  minHeight: constraints.maxHeight - NbSpace.screen * 2,
                ),
                child: Column(
                  children: [
                    const SizedBox(height: NbSpace.xl),
                    const Center(child: NextLogo(size: 40)),
                    const SizedBox(height: NbSpace.xxl * 3),
                    Container(
                      padding: const EdgeInsets.all(NbSpace.xl),
                      decoration: BoxDecoration(
                        color: colors.surface,
                        borderRadius: BorderRadius.circular(NbRadius.card),
                        border: Border.all(color: colors.border),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Semantics(
                            header: true,
                            child: Text(
                              name == null ? 'Olá!' : 'Olá, $name',
                              style: text.headlineSmall,
                            ),
                          ),
                          if (widget.shortcuts.isNotEmpty) ...[
                            const SizedBox(height: NbSpace.xl),
                            Row(
                              children: [
                                for (final shortcut in widget.shortcuts)
                                  Expanded(
                                    child: ActionTile(
                                      icon: shortcut.icon,
                                      label: shortcut.label,
                                      onPressed: () => _open(shortcut),
                                    ),
                                  ),
                              ],
                            ),
                          ],
                          const SizedBox(height: NbSpace.xl),
                          if (biometrics && !_typing)
                            ..._biometricAccess()
                          else
                            ..._pinAccess(text),
                          if (widget.otherAccount case final otherAccount?) ...[
                            const SizedBox(height: NbSpace.md),
                            Center(child: otherAccount),
                          ],
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
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
      const SizedBox(height: NbSpace.sm),
      Center(
        child: TextButton(
          onPressed: () => setState(() => _typing = true),
          child: const Text('Usar PIN'),
        ),
      ),
    ];
  }

  List<Widget> _pinAccess(TextTheme text) {
    final state = ref.watch(unlockControllerProvider);
    return [
      Text('Digite seu PIN para acessar a conta.', style: text.bodySmall),
      const SizedBox(height: NbSpace.lg),
      if (state.blocked)
        // Nothing left to type: the message says why, leaving says how.
        InfoNotice(message: state.error ?? '')
      else
        PinField(
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
