import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:next_bank/core/profile/profile_controller.dart';
import 'package:next_bank/features/home/presentation/home_providers.dart';

/// Home (screen 6; mockups home-dark and home-light): the greeting and the
/// available balance. Shortcuts, recent activity and the floating navigation
/// arrive with the screens they open (weeks 6 and 7, decision D7).
class HomeScreen extends ConsumerWidget {
  /// Creates the home with the header [actions] the app provides.
  const new({this.actions = const [], super.key});

  /// Buttons at the end of the header, such as sign-out.
  final List<Widget> actions;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final name = ref.watch(profileProvider).value?.name ?? '';
    final greeting = greetingFor(ref.watch(nowProvider)());
    return Scaffold(
      body: GlowBackground(
        child: SafeArea(
          child: ListView(
            padding: const EdgeInsets.all(NbSpace.screen),
            children: [
              _Header(greeting: greeting, name: name, actions: actions),
              const SizedBox(height: NbSpace.xxl),
              const DisplayTitle(
                lead: 'Seu dinheiro,',
                trail: 'um passo à frente.',
              ),
              const SizedBox(height: NbSpace.xxl),
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
    final text = Theme.of(context).textTheme;
    return Row(
      children: [
        // The initial repeats the name, which is read right after it.
        ExcludeSemantics(
          child: CircleAvatar(
            radius: NbSize.touch / 2,
            backgroundColor: colors.surface2,
            child: Text(
              name.isEmpty ? '' : name.characters.first.toUpperCase(),
              style: text.titleMedium,
            ),
          ),
        ),
        const SizedBox(width: NbSpace.md),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(greeting, style: text.bodySmall),
              Text(
                name,
                style: text.titleMedium,
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
