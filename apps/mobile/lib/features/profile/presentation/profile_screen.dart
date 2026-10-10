import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:next_bank/core/account/account_providers.dart';
import 'package:next_bank/core/profile/profile_controller.dart';

/// Profile (screen 13): who is signed in, their account, Security and the way
/// out (week 7 plan, D6 and T3-1). Only what the app already has: no e-mail
/// or CPF, which would need new fields from the API (READ-02).
class ProfileScreen extends ConsumerWidget {
  /// Creates the screen; the app provides where Security goes and the
  /// sign-out button, so features never import each other.
  const new({required this.onSecurity, required this.signOut, super.key});

  /// Opens Security.
  final VoidCallback onSecurity;

  /// The sign-out button, from the auth feature.
  final Widget signOut;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.nbColors;
    final text = Theme.of(context).textTheme;
    final name = ref.watch(profileProvider).value?.name ?? '';
    final account = ref.watch(accountProvider).value;
    return Scaffold(
      body: GlowBackground(
        child: SafeArea(
          child: ListView(
            padding: const EdgeInsets.all(NbSpace.screen),
            children: [
              Semantics(
                header: true,
                child: Text('Perfil', style: text.headlineSmall),
              ),
              const SizedBox(height: NbSpace.xl),
              Row(
                children: [
                  ExcludeSemantics(
                    child: Container(
                      width: 56,
                      height: 56,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: colors.surface2,
                        shape: BoxShape.circle,
                        border: Border.all(color: colors.border),
                      ),
                      child: Text(
                        name.isEmpty ? '' : name.characters.first.toUpperCase(),
                        style: NbType.avatar.copyWith(color: colors.text),
                      ),
                    ),
                  ),
                  const SizedBox(width: NbSpace.lg),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          name,
                          style: NbType.bodyStrong.copyWith(color: colors.text),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          account == null
                              ? 'next bank'
                              : 'next bank · Ag ${account.branch} · Conta '
                                    '${_lastFour(account.number)}',
                          style: NbType.caption.copyWith(
                            color: colors.textMuted,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: NbSpace.xl),
              _Row(
                icon: Icons.shield_outlined,
                title: 'Segurança',
                caption: 'Aparelhos, PIN e senha',
                onTap: onSecurity,
              ),
              const SizedBox(height: NbSpace.xl),
              Row(
                children: [
                  signOut,
                  const SizedBox(width: NbSpace.md),
                  // Wraps on a small phone with large text (brief, section 8).
                  Expanded(
                    child: Text(
                      'Sair da conta',
                      style: NbType.bodyText.copyWith(color: colors.text),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// Only the last four digits, as everywhere (brief, section 7).
  static String _lastFour(String number) {
    final digits = number.replaceAll(RegExp(r'\D'), '');
    return '•••• ${digits.substring(digits.length - 4)}';
  }
}

class _Row extends StatelessWidget {
  const new({
    required this.icon,
    required this.title,
    required this.caption,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String caption;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;
    return Semantics(
      container: true,
      button: true,
      label: '$title, $caption',
      excludeSemantics: true,
      child: Material(
        color: colors.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(NbRadius.block),
          side: BorderSide(color: colors.border),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(NbSpace.lg),
            child: Row(
              children: [
                Icon(icon, color: colors.accent),
                const SizedBox(width: NbSpace.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: NbType.bodyText.copyWith(color: colors.text),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        caption,
                        style: NbType.caption.copyWith(color: colors.textMuted),
                      ),
                    ],
                  ),
                ),
                Icon(Icons.chevron_right, color: colors.textMuted),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
