import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:next_bank/features/profile/presentation/menu_section.dart';

/// The "Configurações" tab: the look, security and the account, then the
/// way out.
class SettingsTab extends StatelessWidget {
  /// Creates the tab; the profile says where each row goes.
  const new({
    required this.onTheme,
    required this.onChangePin,
    required this.onChangePassword,
    required this.onSecurity,
    required this.onManageAccounts,
    required this.signOut,
    super.key,
  });

  /// Opens the theme picker.
  final VoidCallback onTheme;

  /// Opens the PIN change.
  final VoidCallback onChangePin;

  /// Opens the password change.
  final VoidCallback onChangePassword;

  /// Opens Security: the connected devices and biometrics.
  final VoidCallback onSecurity;

  /// Opens "Gerenciar contas".
  final VoidCallback onManageAccounts;

  /// The sign-out button, from the auth feature.
  final Widget signOut;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: NbSpace.xl,
      children: [
        MenuSection(
          title: 'Personalização',
          rows: [
            MenuRow(
              icon: Icons.dark_mode_outlined,
              title: 'Tema do app',
              onTap: onTheme,
            ),
          ],
        ),
        MenuSection(
          title: 'Segurança e privacidade',
          rows: [
            MenuRow(
              icon: Icons.pin_outlined,
              title: 'Trocar PIN',
              onTap: onChangePin,
            ),
            MenuRow(
              icon: Icons.password_outlined,
              title: 'Trocar senha',
              onTap: onChangePassword,
            ),
            MenuRow(
              icon: Icons.devices_outlined,
              title: 'Aparelhos conectados e biometria',
              onTap: onSecurity,
            ),
          ],
        ),
        MenuSection(
          title: 'Configurações da conta',
          rows: [
            MenuRow(
              icon: Icons.manage_accounts_outlined,
              title: 'Gerenciar contas',
              onTap: onManageAccounts,
            ),
          ],
        ),
        signOut,
      ],
    );
  }
}
