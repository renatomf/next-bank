import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:next_bank/core/account/account_providers.dart';
import 'package:next_bank/core/clock.dart';
import 'package:next_bank/core/profile/profile_controller.dart';
import 'package:next_bank/features/home/presentation/home_providers.dart';

/// Home (screen 6; mockups home-dark and home-light): the greeting and the
/// available balance, and the Pix shortcut. Recent activity and the floating
/// navigation arrive with the screens they open (weeks 6 and 7, decision D7).
class HomeScreen extends ConsumerWidget {
  /// Creates the home; the app provides the header [actions] and where the
  /// shortcuts go, so features never import each other.
  const new({required this.onPix, this.actions = const [], super.key});

  /// Opens the Pix.
  final VoidCallback onPix;

  /// Buttons at the end of the header, such as sign-out.
  final List<Widget> actions;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final name = ref.watch(profileProvider).value?.name ?? '';
    final greeting = greetingFor(ref.watch(nowProvider)());
    return Scaffold(
      body: GlowBackground(
        child: SafeArea(
          // Mockup: 28 px on top, 20 on the sides, 22 between sections.
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 28, 20, 20),
            children: [
              _Header(greeting: greeting, name: name, actions: actions),
              const SizedBox(height: 22),
              const DisplayTitle(
                lead: 'Seu dinheiro,',
                trail: 'um passo à frente.',
              ),
              const SizedBox(height: 22),
              // The mockup's row of four; the other three shortcuts come with
              // their screens, so the Pix keeps a quarter of the width.
              Row(
                children: [
                  Expanded(
                    child: ActionTile(
                      icon: Icons.diamond_outlined,
                      label: 'Área Pix',
                      onPressed: onPix,
                    ),
                  ),
                  const Spacer(flex: 3),
                ],
              ),
              const SizedBox(height: 22),
              const _Balance(),
            ],
          ),
        ),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const new({
    required this.greeting,
    required this.name,
    required this.actions,
  });

  final String greeting;
  final String name;
  final List<Widget> actions;

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;
    return Row(
      children: [
        // The initial repeats the name, which is read right after it.
        ExcludeSemantics(
          child: Container(
            width: NbSize.touch,
            height: NbSize.touch,
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
        const SizedBox(width: NbSpace.md),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                greeting,
                style: NbType.captionPlain.copyWith(color: colors.textMuted),
              ),
              const SizedBox(height: 2),
              Text(
                name,
                style: NbType.bodyStrong.copyWith(color: colors.text),
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
        ...actions,
      ],
    );
  }
}

class _Balance extends ConsumerWidget {
  const new();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final hidden = ref.watch(balanceHiddenProvider);
    void toggle() => ref.read(balanceHiddenProvider.notifier).toggle();
    return switch (ref.watch(accountProvider)) {
      AsyncData(value: final account) => BalanceCard(
        accountNumber: account.number,
        balanceCents: account.availableBalanceCents,
        hidden: hidden,
        onToggleHidden: toggle,
      ),
      AsyncError() => Padding(
        padding: const EdgeInsets.symmetric(vertical: NbSpace.xl),
        child: ErrorState(
          message: 'Não foi possível carregar seu saldo.',
          onRetry: () => ref.invalidate(accountProvider),
        ),
      ),
      _ => BalanceCard(
        accountNumber: null,
        balanceCents: null,
        hidden: hidden,
        onToggleHidden: toggle,
      ),
    };
  }
}
