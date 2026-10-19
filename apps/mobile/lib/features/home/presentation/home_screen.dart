import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:next_bank/core/account/account_providers.dart';
import 'package:next_bank/core/api_failure.dart';
import 'package:next_bank/core/profile/profile_controller.dart';
import 'package:next_bank/core/refresh_failure.dart';
import 'package:next_bank/features/home/presentation/assistant_bar.dart';
import 'package:next_bank/features/home/presentation/balance_section.dart';
import 'package:next_bank/features/home/presentation/greeting_header.dart';
import 'package:next_bank/features/home/presentation/pix_box/pix_box.dart';
import 'package:next_bank/features/home/presentation/shortcuts_row.dart';

/// The Home (screen 6), from top to bottom: the greeting, the assistant, the
/// shortcuts, the balance and the Pix box. Each part lives in its own file;
/// this one only puts them in order. The app says where every action goes,
/// so features never import each other.
class HomeScreen extends ConsumerWidget {
  /// Creates the Home.
  const new({
    required this.onPix,
    required this.onPay,
    required this.onReceive,
    required this.onStatement,
    required this.onPixWithKey,
    required this.onTransfer,
    required this.onAutomatic,
    required this.onKeys,
    required this.onProfile,
    required this.onHelp,
    required this.onNotifications,
    super.key,
  });

  /// Opens the Pix area.
  final VoidCallback onPix;

  /// Opens the reading of a Pix QR Code.
  final VoidCallback onPay;

  /// Opens "Receber", with the customer's QR Code.
  final VoidCallback onReceive;

  /// Opens the statement.
  final VoidCallback onStatement;

  /// Opens the Pix with a CPF key typed in the Pix box, in digits.
  final ValueChanged<String> onPixWithKey;

  /// Opens "Transferir Pix".
  final VoidCallback onTransfer;

  /// Opens "Pix Automático".
  final VoidCallback onAutomatic;

  /// Opens "Minhas chaves".
  final VoidCallback onKeys;

  /// Opens the profile.
  final VoidCallback onProfile;

  /// Opens the help.
  final VoidCallback onHelp;

  /// Opens the notifications.
  final VoidCallback onNotifications;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(profileProvider).value;
    final firstName = (profile?.name ?? '').split(' ').first;
    toastFailedRefresh(context, ref, accountProvider);

    return Scaffold(
      body: GlowBackground(
        child: SafeArea(
          child: RefreshIndicator(
            onRefresh: () => _reloadBalance(ref),
            // Mockup: 28 on top, 20 on the sides.
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(20, 28, 20, 20),
              children: [
                GreetingHeader(firstName: firstName, onProfile: onProfile),
                const SizedBox(height: 22),
                AssistantBar(onHelp: onHelp, onNotifications: onNotifications),
                const SizedBox(height: NbSpace.xl),
                ShortcutsRow(
                  onPix: onPix,
                  onPay: onPay,
                  onTransfer: onTransfer,
                ),
                const SizedBox(height: 28),
                BalanceSection(onStatement: onStatement),
                const SizedBox(height: 28),
                PixBox(
                  cpfMasked: profile?.cpfMasked,
                  onPix: onPix,
                  onPixWithKey: onPixWithKey,
                  onTransfer: onTransfer,
                  onPay: onPay,
                  onReceive: onReceive,
                  onAutomatic: onAutomatic,
                  onKeys: onKeys,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  /// Pulled down, the Home reads the balance again, as when money arrives
  /// with the app open. A failure is told by the toast; the screen keeps
  /// what it had.
  Future<void> _reloadBalance(WidgetRef ref) async {
    try {
      ref.invalidate(accountProvider);
      await ref.read(accountProvider.future);
    } on ApiFailure {
      // Told by the toast.
    }
  }
}
