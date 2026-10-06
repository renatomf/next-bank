import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:next_bank/app/router.dart';
import 'package:next_bank/core/api_client.dart';
import 'package:next_bank/core/session/secure_token_store.dart';
import 'package:next_bank/core/session/session_controller.dart';
import 'package:next_bank/features/auth/data/http_auth_repository.dart';
import 'package:next_bank/features/auth/presentation/auth_providers.dart';
import 'package:next_bank/features/home/data/http_api_status_repository.dart';
import 'package:next_bank/features/home/presentation/api_status_provider.dart';

/// Composition root: the only place that binds domain interfaces
/// to their implementations.
void main() {
  runApp(
    ProviderScope(
      overrides: [
        tokenStoreProvider.overrideWithValue(SecureTokenStore()),
        authRepositoryProvider.overrideWith(
          (ref) => HttpAuthRepository(ref.watch(apiProvider).getDefaultApi()),
        ),
        apiStatusRepositoryProvider.overrideWith(
          (ref) =>
              HttpApiStatusRepository(ref.watch(apiProvider).getDefaultApi()),
        ),
      ],
      child: const NextBankApp(),
    ),
  );
}

/// Root of the next bank app.
class NextBankApp extends ConsumerWidget {
  /// Creates the app root.
  const new({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Dark is the V1 look; the theme picker comes later (roadmap).
    return MaterialApp.router(
      title: 'next bank',
      theme: NbTheme.dark(),
      routerConfig: ref.watch(routerProvider),
    );
  }
}
