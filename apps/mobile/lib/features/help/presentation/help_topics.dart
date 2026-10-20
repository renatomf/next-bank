import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:next_bank/features/help/presentation/help_screen.dart';

/// "Dúvidas por produto": six topics of what the app has, in two rows of
/// three, with the Home's shortcut tiles.
class HelpTopics extends StatelessWidget {
  /// Creates the topics.
  const new({super.key});

  static const List<(Widget, String)> _topics = [
    (PixMark(), 'Pix'),
    (Icon(Icons.qr_code_scanner), 'Pagar QR Code'),
    (Icon(Icons.qr_code_2), 'Receber'),
    (Icon(Icons.receipt_long_outlined), 'Extrato'),
    (Icon(Icons.shield_outlined), 'Segurança'),
    (Icon(Icons.person_outline), 'Conta'),
  ];

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Expanded(
              child: Semantics(
                header: true,
                child: Text(
                  'Dúvidas por produto',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ),
            ),
            TextButton(
              onPressed: () => sayComingSoon(context),
              child: const Text('Exibir todos'),
            ),
          ],
        ),
        Text(
          'Selecione o assunto e navegue nas dúvidas e dicas relacionadas.',
          style: NbType.caption.copyWith(color: colors.textMuted),
        ),
        const SizedBox(height: NbSpace.lg),
        Column(
          spacing: NbSpace.sm,
          children: [
            _TopicRow(topics: _topics.sublist(0, 3)),
            _TopicRow(topics: _topics.sublist(3)),
          ],
        ),
      ],
    );
  }
}

/// Three topics side by side, sharing the width.
class _TopicRow extends StatelessWidget {
  const new({required this.topics});

  final List<(Widget, String)> topics;

  @override
  Widget build(BuildContext context) {
    return Row(
      spacing: NbSpace.sm,
      children: [
        for (final (icon, label) in topics)
          Expanded(
            child: ActionTile(
              icon: icon,
              label: label,
              onPressed: () => sayComingSoon(context),
            ),
          ),
      ],
    );
  }
}
