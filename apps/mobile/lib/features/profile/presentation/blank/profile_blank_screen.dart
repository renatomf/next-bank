import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';

/// A profile screen still blank, only its header and the way back (v1.1.0
/// plan, task 4.4): Meus dados cadastrais, Conta compartilhada, Convidar
/// amigos and Gerenciar contas. Each one gets its own file when it gets its
/// layout.
class ProfileBlankScreen extends StatelessWidget {
  /// Creates the screen named [title]; the router says where back goes.
  const new({required this.title, required this.onBack, super.key});

  /// The screen's name.
  final String title;

  /// Leaves the screen.
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) => Scaffold(
    body: GlowBackground(
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(NbSpace.screen),
          child: Column(
            children: [
              ScreenHeader(
                title: title,
                icon: Icons.arrow_back,
                iconLabel: 'Voltar',
                onPressed: onBack,
              ),
            ],
          ),
        ),
      ),
    ),
  );
}
