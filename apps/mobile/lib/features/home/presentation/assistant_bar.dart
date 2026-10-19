import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';

/// "Posso te ajudar?" with the help and notification buttons beside it. The
/// help button opens the help (v1.1.0 plan, task 4.5) and the bell the
/// notifications (task 4.6); the assistant comes later and says so (week 8
/// plan, V9).
class AssistantBar extends StatelessWidget {
  /// Creates the bar.
  const new({required this.onHelp, required this.onNotifications, super.key});

  /// Opens the help.
  final VoidCallback onHelp;

  /// Opens the notifications.
  final VoidCallback onNotifications;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        const Expanded(child: _AssistantField()),
        const SizedBox(width: NbSpace.sm),
        IconCircleButton(
          icon: Icons.help_outline,
          label: 'Ajuda',
          onPressed: onHelp,
        ),
        const SizedBox(width: NbSpace.sm),
        IconCircleButton(
          icon: Icons.notifications_none,
          label: 'Notificações',
          onPressed: onNotifications,
        ),
      ],
    );
  }
}

/// A button shaped like a field, for the assistant to come: honest about
/// it, it says so when tapped.
class _AssistantField extends StatelessWidget {
  const new();

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;

    return Semantics(
      button: true,
      label: 'Posso te ajudar? Assistente, em breve',
      excludeSemantics: true,
      child: Material(
        color: colors.surface,
        shape: StadiumBorder(side: BorderSide(color: colors.border)),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: () => showNbToast(
            context,
            'Em breve: assistente com IA.',
            icon: Icons.info_outline,
          ),
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 48),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: NbSpace.lg),
              child: Row(
                children: [
                  Icon(Icons.auto_awesome, color: colors.accent),
                  const SizedBox(width: NbSpace.md),
                  Expanded(
                    child: Text(
                      'Posso te ajudar?',
                      style: NbType.bodyText.copyWith(color: colors.textMuted),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
