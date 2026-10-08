import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:next_bank/app/router.dart';
import 'package:next_bank/core/account/account_providers.dart';
import 'package:next_bank/core/account/http_account_repository.dart';
import 'package:next_bank/core/api_client.dart';
import 'package:next_bank/core/profile/http_profile_repository.dart';
import 'package:next_bank/core/profile/profile_controller.dart';
import 'package:next_bank/core/session/app_lock.dart';
import 'package:next_bank/core/session/secure_token_store.dart';
import 'package:next_bank/core/session/session_controller.dart';
import 'package:next_bank/core/statement/http_statement_repository.dart';
import 'package:next_bank/core/statement/statement_controller.dart';
import 'package:next_bank/features/auth/data/http_auth_repository.dart';
import 'package:next_bank/features/auth/presentation/auth_providers.dart';
import 'package:next_bank/features/pix/data/http_pix_repository.dart';
import 'package:next_bank/features/pix/presentation/pix_providers.dart';
import 'package:next_bank/features/unlock/data/http_unlock_repository.dart';
import 'package:next_bank/features/unlock/presentation/unlock_providers.dart';

/// Composition root: the only place that binds domain interfaces
/// to their implementations.
void main() {
  runApp(
    ProviderScope(
      overrides: [
        tokenStoreProvider.overrideWithValue(SecureTokenStore()),
        profileRepositoryProvider.overrideWith(
          (ref) =>
              HttpProfileRepository(ref.watch(apiProvider).getDefaultApi()),
        ),
        authRepositoryProvider.overrideWith(
          (ref) => HttpAuthRepository(ref.watch(apiProvider).getDefaultApi()),
        ),
        accountRepositoryProvider.overrideWith(
          (ref) =>
              HttpAccountRepository(ref.watch(apiProvider).getDefaultApi()),
        ),
        pixRepositoryProvider.overrideWith(
          (ref) => HttpPixRepository(ref.watch(apiProvider).getDefaultApi()),
        ),
        statementRepositoryProvider.overrideWith(
          (ref) =>
              HttpStatementRepository(ref.watch(apiProvider).getDefaultApi()),
        ),
        unlockRepositoryProvider.overrideWith(
          (ref) => HttpUnlockRepository(ref.watch(apiProvider).getDefaultApi()),
        ),
      ],
      child: const NextBankApp(),
    ),
  );
}

/// Root of the next bank app.
class NextBankApp extends ConsumerStatefulWidget {
  /// Creates the app root.
  const new({super.key});

  @override
  ConsumerState<NextBankApp> createState() => _NextBankAppState();
}

class _NextBankAppState extends ConsumerState<NextBankApp> {
  late final AppLifecycleListener _lifecycle;

  @override
  void initState() {
    super.initState();
    // Time in the background counts toward the Unlock screen (F-16).
    _lifecycle = AppLifecycleListener(
      onPause: () => ref.read(appLockProvider.notifier).paused(),
      onResume: () => ref.read(appLockProvider.notifier).resumed(),
    );
  }

  @override
  void dispose() {
    _lifecycle.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // Dark is the V1 look; the theme picker comes later (roadmap).
    return MaterialApp.router(
      title: 'next bank',
      theme: NbTheme.dark(),
      routerConfig: ref.watch(routerProvider),
    );
  }
}
