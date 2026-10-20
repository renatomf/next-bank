import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:next_bank/features/assistant/presentation/assistant_agents.dart';

/// Opens "Qual agente quer usar?"; an agent picked closes it and says it is
/// coming, as none works yet.
Future<void> showAgentSheet(BuildContext context) async {
  final picked = await showModalBottomSheet<AssistantAgent>(
    context: context,
    isScrollControlled: true,
    builder: (_) => const AgentSheet(),
  );
  if (picked != null && context.mounted) {
    showNbToast(context, 'Em breve.', icon: Icons.info_outline);
  }
}

/// The assistant's agents, each with what it helps with (v1.1.0 plan, task
/// 4.10); the X closes the sheet.
class AgentSheet extends StatelessWidget {
  /// Creates the sheet.
  const new({super.key});

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(NbSpace.screen),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          spacing: NbSpace.md,
          children: [
            Row(
              children: [
                Expanded(
                  child: Semantics(
                    header: true,
                    child: Text(
                      'Qual agente quer usar?',
                      style: context.nbText.screenTitle,
                    ),
                  ),
                ),
                IconCircleButton(
                  icon: Icons.close,
                  label: 'Fechar',
                  onPressed: () => Navigator.of(context).pop(),
                ),
              ],
            ),
            for (final agent in assistantAgents) _AgentRow(agent: agent),
          ],
        ),
      ),
    );
  }
}

class _AgentRow extends StatelessWidget {
  const new({required this.agent});

  final AssistantAgent agent;

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;
    void pick() => Navigator.of(context).pop(agent);

    return Semantics(
      button: true,
      label: '${agent.name}. ${agent.description}',
      onTap: pick,
      excludeSemantics: true,
      child: Material(
        color: colors.surface2,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(NbRadius.boxInner),
          side: BorderSide(color: colors.border),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: pick,
          child: Padding(
            padding: const EdgeInsets.all(NbSpace.lg),
            child: Row(
              children: [
                Icon(agent.icon, size: NbSize.icon, color: colors.accent),
                const SizedBox(width: NbSpace.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    spacing: NbSpace.xs,
                    children: [
                      Text(agent.name, style: context.nbText.bodyStrong),
                      Text(agent.description, style: context.nbText.caption),
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
