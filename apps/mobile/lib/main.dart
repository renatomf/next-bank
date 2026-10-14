import 'dart:async';

import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:next_bank/app/router.dart';
import 'package:next_bank/core/account/account_providers.dart';
import 'package:next_bank/core/account/http_account_repository.dart';
import 'package:next_bank/core/api_client.dart';
import 'package:next_bank/core/error_reporting.dart';
import 'package:next_bank/core/profile/http_profile_repository.dart';
import 'package:next_bank/core/profile/profile_controller.dart';
import 'package:next_bank/core/session/app_lock.dart';
import 'package:next_bank/core/session/secure_token_store.dart';
import 'package:next_bank/core/session/session_controller.dart';
import 'package:next_bank/core/share/share_plus_text_sharer.dart';
import 'package:next_bank/core/share/text_sharer.dart';
import 'package:next_bank/core/statement/http_statement_repository.dart';
import 'package:next_bank/core/statement/statement_controller.dart';
import 'package:next_bank/core/theme/secure_theme_store.dart';
import 'package:next_bank/core/theme/theme_choice.dart';
import 'package:next_bank/core/theme/theme_controller.dart';
import 'package:next_bank/features/auth/data/http_auth_repository.dart';
import 'package:next_bank/features/auth/presentation/auth_providers.dart';
import 'package:next_bank/features/pix/data/http_pix_repository.dart';
import 'package:next_bank/features/pix/presentation/pix_providers.dart';
import 'package:next_bank/features/security/data/http_security_repository.dart';
import 'package:next_bank/features/security/presentation/security_providers.dart';
import 'package:next_bank/features/unlock/data/http_unlock_repository.dart';
import 'package:next_bank/features/unlock/presentation/unlock_providers.dart';

/// Composition root: the only place that binds domain interfaces
/// to their implementations.
Future<void> main() async {
  // Edge to edge: the app draws under the phone's own buttons, as in the
  // reference (week 8 plan, V10). Android 15 does it by default.
  WidgetsFlutterBinding.ensureInitialized();
  unawaited(SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge));
  // Unexpected errors reach Sentry only in builds with a DSN (week 8 plan,
  // PR c).
  await runWithErrorReporting(
    () => runApp(
      ProviderScope(
        overrides: [
          tokenStoreProvider.overrideWithValue(SecureTokenStore()),
          themeStoreProvider.overrideWithValue(SecureThemeStore()),
          textSharerProvider.overrideWithValue(SharePlusTextSharer()),
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
          securityRepositoryProvider.overrideWith(
            (ref) =>
                HttpSecurityRepository(ref.watch(apiProvider).getDefaultApi()),
          ),
          unlockRepositoryProvider.overrideWith(
            (ref) =>
                HttpUnlockRepository(ref.watch(apiProvider).getDefaultApi()),
          ),
        ],
        child: const NextBankApp(),
      ),
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
      onResume: () {
        ref.read(appLockProvider.notifier).resumed();
        // Money may have arrived while the app was away: the balance and the
        // statement are read again by whichever screen shows them.
        ref
          ..invalidate(accountProvider)
          ..invalidate(statementProvider);
      },
    );
  }

  @override
  void dispose() {
    _lifecycle.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // Follows the phone until the customer picks one on the Profile (D9).
    final choice = ref.watch(themeChoiceProvider).value ?? ThemeChoice.system;
    return MaterialApp.router(
      title: 'next bank',
      theme: NbTheme.light(),
      darkTheme: NbTheme.dark(),
      themeMode: choice.mode,
      routerConfig: ref.watch(routerProvider),
      builder: (context, child) => AnnotatedRegion<SystemUiOverlayStyle>(
        value: _systemBarsFor(Theme.of(context).brightness),
        child: child ?? const SizedBox.shrink(),
      ),
    );
  }
}

/// The phone's own buttons over the app's navigation bar, with no band of
/// forced contrast behind them, in icons that read on the theme (week 8 plan,
/// V10).
SystemUiOverlayStyle _systemBarsFor(Brightness theme) {
  final icons = theme == Brightness.dark ? Brightness.light : Brightness.dark;
  return SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: icons,
    statusBarBrightness: theme,
    systemNavigationBarColor: Colors.transparent,
    systemNavigationBarDividerColor: Colors.transparent,
    systemNavigationBarIconBrightness: icons,
    systemNavigationBarContrastEnforced: false,
  );
}
