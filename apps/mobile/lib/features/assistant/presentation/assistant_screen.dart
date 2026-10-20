import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:next_bank/core/profile/profile_controller.dart';
import 'package:next_bank/features/assistant/presentation/agent_sheet.dart';
import 'package:next_bank/features/assistant/presentation/assistant_agents.dart';
import 'package:next_bank/features/assistant/presentation/assistant_input_bar.dart';
import 'package:next_bank/features/assistant/presentation/suggestion_chips.dart';

/// The assistant (v1.1.0 plan, task 4.10), layout only for now: the
/// greeting, the agents, the suggestions and the field. No AI answers yet:
/// every action says it is coming.
class AssistantScreen extends ConsumerWidget {
  /// Creates the screen; the router says where the X goes.
  const new({required this.onClose, super.key});

  /// Leaves the assistant.
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.nbColors;
    final name = ref.watch(profileProvider).value?.name ?? '';
    final firstName = name.split(' ').first;

    return Scaffold(
      body: GlowBackground(
        child: SafeArea(
          // The field sits at the bottom when there is room; on a small
          // phone with large text the whole screen scrolls instead.
          child: CustomScrollView(
            slivers: [
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(
                  NbSpace.screen,
                  NbSpace.screen,
                  NbSpace.screen,
                  0,
                ),
                sliver: SliverList.list(
                  children: [
                    _Header(onClose: onClose),
                    const SizedBox(height: NbSpace.xl),
                    Text(
                      'Olá, $firstName',
                      style: context.nbText.bodyText.copyWith(
                        color: colors.textMuted,
                      ),
                    ),
                    const SizedBox(height: NbSpace.xs),
                    Text(
                      'Como podemos começar?',
                      style: context.nbText.screenTitle,
                    ),
                    const SizedBox(height: NbSpace.lg),
                    for (final agent in assistantAgents)
                      Padding(
                        padding: const EdgeInsets.only(bottom: NbSpace.sm),
                        child: Align(
                          alignment: Alignment.centerLeft,
                          child: NbChip(
                            label: agent.name,
                            icon: agent.icon,
                            onPressed: () => showNbToast(
                              context,
                              'Em breve.',
                              icon: Icons.info_outline,
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
              SliverFillRemaining(
                hasScrollBody: false,
                child: Padding(
                  padding: const EdgeInsets.all(NbSpace.screen),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.end,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const SuggestionChips(),
                      const SizedBox(height: NbSpace.sm),
                      const AssistantInputBar(),
                      const SizedBox(height: NbSpace.sm),
                      Text(
                        'Respostas geradas por IA',
                        textAlign: TextAlign.center,
                        style: context.nbText.cardLabel,
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// The X, "Escolher agente" and the new chat.
class _Header extends StatelessWidget {
  const new({required this.onClose});

  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    return Row(
      spacing: NbSpace.sm,
      children: [
        IconCircleButton(
          icon: Icons.close,
          label: 'Fechar',
          onPressed: onClose,
        ),
        // A chip with a dropdown's arrow, opening the agent sheet; it takes
        // the room between the X and the new chat, shrinking if short.
        Expanded(
          child: Align(
            alignment: Alignment.centerLeft,
            child: NbChip(
              label: 'Escolher agente',
              trailingIcon: Icons.expand_more,
              onPressed: () => showAgentSheet(context),
            ),
          ),
        ),
        NbIconButton(
          icon: Icons.edit_square,
          label: 'Nova conversa',
          onPressed: () =>
              showNbToast(context, 'Em breve.', icon: Icons.info_outline),
        ),
      ],
    );
  }
}
