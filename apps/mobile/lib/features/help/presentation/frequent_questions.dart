import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:next_bank/features/help/presentation/help_screen.dart';

/// "Dúvidas mais acessadas": generic questions about what the app has, in
/// one card.
class FrequentQuestions extends StatelessWidget {
  /// Creates the list.
  const new({super.key});

  static const List<String> _questions = [
    'Como fazer um Pix?',
    'Como pagar com QR Code?',
    'Como trocar o meu PIN?',
    'Como ver o meu extrato?',
    'Como desconectar um aparelho?',
  ];

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Semantics(
          header: true,
          child: Text(
            'Dúvidas mais acessadas',
            style: Theme.of(context).textTheme.titleMedium,
          ),
        ),
        const SizedBox(height: NbSpace.md),
        MenuGroup(
          children: [
            for (final question in _questions)
              MenuRow(title: question, onTap: () => sayComingSoon(context)),
          ],
        ),
      ],
    );
  }
}
