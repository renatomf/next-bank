import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:next_bank/features/profile/presentation/menu_section.dart';

/// The "Perfil" tab: the customer's account matters.
class ProfileTab extends StatelessWidget {
  /// Creates the tab; the profile says where each row goes.
  const new({
    required this.onPersonalData,
    required this.onSharedAccount,
    required this.onInviteFriends,
    super.key,
  });

  /// Opens "Meus dados cadastrais".
  final VoidCallback onPersonalData;

  /// Opens "Conta compartilhada".
  final VoidCallback onSharedAccount;

  /// Opens "Convidar amigos".
  final VoidCallback onInviteFriends;

  @override
  Widget build(BuildContext context) {
    return MenuSection(
      title: 'Conta',
      rows: [
        MenuRow(
          icon: Icons.assignment_ind_outlined,
          title: 'Meus dados cadastrais',
          onTap: onPersonalData,
        ),
        MenuRow(
          icon: Icons.group_outlined,
          title: 'Conta compartilhada',
          onTap: onSharedAccount,
        ),
        MenuRow(
          icon: Icons.person_add_alt_outlined,
          title: 'Convidar amigos',
          onTap: onInviteFriends,
        ),
      ],
    );
  }
}
