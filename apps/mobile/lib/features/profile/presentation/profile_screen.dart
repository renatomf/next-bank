import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:next_bank/features/profile/presentation/account_card.dart';
import 'package:next_bank/features/profile/presentation/profile_header.dart';
import 'package:next_bank/features/profile/presentation/profile_tab.dart';
import 'package:next_bank/features/profile/presentation/settings_tab.dart';

/// Profile (screen 13, redesigned in v1.1.0 plan, task 4.4), from top to
/// bottom: the header, the account card and the "Perfil" and
/// "Configurações" tabs. Each part lives in its own file; this one puts them
/// in order and switches the tabs. The app says where every row goes, so
/// features never import each other.
class ProfileScreen extends StatefulWidget {
  /// Creates the screen.
  const new({
    required this.onClose,
    required this.onPersonalData,
    required this.onSharedAccount,
    required this.onInviteFriends,
    required this.onTheme,
    required this.onChangePin,
    required this.onChangePassword,
    required this.onSecurity,
    required this.onManageAccounts,
    required this.signOut,
    required this.switchAccount,
    super.key,
  });

  /// Leaves the profile, to the Home.
  final VoidCallback onClose;

  /// Opens "Meus dados cadastrais".
  final VoidCallback onPersonalData;

  /// Opens "Conta compartilhada".
  final VoidCallback onSharedAccount;

  /// Opens "Convidar amigos".
  final VoidCallback onInviteFriends;

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

  /// "Trocar conta", from the auth feature.
  final Widget switchAccount;

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs = TabController(length: 2, vsync: this);

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: GlowBackground(
        child: SafeArea(
          child: ListView(
            padding: const EdgeInsets.all(NbSpace.screen),
            children: [
              ProfileHeader(
                onClose: widget.onClose,
                switchAccount: widget.switchAccount,
              ),
              const SizedBox(height: NbSpace.xl),
              const AccountCard(),
              const SizedBox(height: NbSpace.xl),
              NbTabBar(
                controller: _tabs,
                labels: const ['Perfil', 'Configurações'],
              ),
              const SizedBox(height: NbSpace.xl),
              // The tabs switch the content below them, without swiping:
              // the whole screen scrolls as one list.
              ListenableBuilder(
                listenable: _tabs,
                builder: (context, _) => _tabs.index == 0
                    ? ProfileTab(
                        onPersonalData: widget.onPersonalData,
                        onSharedAccount: widget.onSharedAccount,
                        onInviteFriends: widget.onInviteFriends,
                      )
                    : SettingsTab(
                        onTheme: widget.onTheme,
                        onChangePin: widget.onChangePin,
                        onChangePassword: widget.onChangePassword,
                        onSecurity: widget.onSecurity,
                        onManageAccounts: widget.onManageAccounts,
                        signOut: widget.signOut,
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
