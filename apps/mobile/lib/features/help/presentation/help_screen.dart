import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:next_bank/features/help/presentation/frequent_questions.dart';
import 'package:next_bank/features/help/presentation/help_topics.dart';

/// Help (v1.1.0 plan, task 4.5), layout only for now: the topics of what the
/// app has and the frequent questions. Every tap says it is coming; nothing
/// opens outside the app (MOB-06).
class HelpScreen extends StatelessWidget {
  /// Creates the screen; the router says where back goes.
  const new({required this.onBack, super.key});

  /// Leaves the screen.
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: GlowBackground(
        child: SafeArea(
          child: ListView(
            padding: const EdgeInsets.all(NbSpace.screen),
            children: [
              ScreenHeader(
                title: 'Ajuda',
                icon: Icons.arrow_back,
                iconLabel: 'Voltar',
                onPressed: onBack,
                // On the right edge, as Exibir todos below; wraps on a small
                // phone with large text (brief, section 8).
                action: Flexible(
                  child: Align(
                    alignment: Alignment.centerRight,
                    child: TextButton(
                      onPressed: () => sayComingSoon(context),
                      child: const Text('Acessar chat'),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: NbSpace.xl),
              const HelpTopics(),
              const SizedBox(height: NbSpace.xl),
              const FrequentQuestions(),
            ],
          ),
        ),
      ),
    );
  }
}

/// What every part of the help says when tapped, for now.
void sayComingSoon(BuildContext context) =>
    showNbToast(context, 'Em breve.', icon: Icons.info_outline);
