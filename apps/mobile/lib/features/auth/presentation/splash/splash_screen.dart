import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:next_bank/core/api_failure.dart';
import 'package:next_bank/core/api_messages.dart';
import 'package:next_bank/core/profile/profile_controller.dart';
import 'package:next_bank/core/session/session_controller.dart';

/// Shown while the session is restored from the device and the account's
/// profile is loaded (screen 1). The router leaves it as soon as both are
/// known.
class SplashScreen extends ConsumerWidget {
  /// Creates the splash screen.
  const new({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.nbColors;
    final sessionFailed = ref.watch(sessionProvider).hasError;
    final profileError = ref.watch(profileProvider).error;
    final failure = switch ((sessionFailed, profileError)) {
      (true, _) => (
        message: 'Não foi possível abrir sua sessão.',
        retry: () => ref.invalidate(sessionProvider),
      ),
      (false, final ApiFailure failure) => (
        message: messageFor(failure),
        retry: () => ref.invalidate(profileProvider),
      ),
      (false, Object()) => (
        message: messageFor(const ApiUnexpected()),
        retry: () => ref.invalidate(profileProvider),
      ),
      (false, null) => null,
    };
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
                  if (failure case (:final message, :final retry)) ...[
                    Text(
                      message,
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                    const SizedBox(height: NbSpace.lg),
                    PrimaryButton(label: 'Tentar de novo', onPressed: retry),
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
