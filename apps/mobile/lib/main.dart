import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:next_bank/core/api_client.dart';
import 'package:next_bank/core/session/secure_token_store.dart';
import 'package:next_bank/core/session/session_controller.dart';
import 'package:next_bank/features/home/data/http_api_status_repository.dart';
import 'package:next_bank/features/home/presentation/api_status_provider.dart';
import 'package:next_bank/features/home/presentation/home_screen.dart';

/// Composition root: the only place that binds domain interfaces
/// to their implementations.
void main() {
  runApp(
    ProviderScope(
      overrides: [
        tokenStoreProvider.overrideWithValue(SecureTokenStore()),
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
class NextBankApp extends StatelessWidget {
  /// Creates the app root.
  const new({super.key});

  @override
  Widget build(BuildContext context) {
    return const MaterialApp(title: 'next bank', home: HomeScreen());
  }
}
