import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:next_bank/core/session/session_controller.dart';

/// Shown while the session is restored from the device (screen 1). The
/// router leaves it as soon as the session is known.
class SplashScreen extends ConsumerWidget {
  /// Creates the splash screen.
  const new({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.nbColors;
    final failed = ref.watch(sessionProvider).hasError;
    return Scaffold(
      body: GlowBackground(
        child: SafeArea(
          child: Center(
            child: Padding(
              padding: const EdgeInsets.all(NbSpace.screen),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const NextLogo(size: 48),
                  const SizedBox(height: NbSpace.xxl),
                  if (failed) ...[
                    Text(
                      'Não foi possível abrir sua sessão.',
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                    const SizedBox(height: NbSpace.lg),
                    PrimaryButton(
                      label: 'Tentar de novo',
                      onPressed: () => ref.invalidate(sessionProvider),
                    ),
                  ] else
                    CircularProgressIndicator(
                      color: colors.accent,
                      semanticsLabel: 'Abrindo sua sessão',
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
