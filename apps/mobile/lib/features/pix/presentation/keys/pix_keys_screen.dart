import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';

/// The customer's Pix keys: blank for now, only its header and the way back
/// (v1.1.0 plan, task 4.2); its layout comes with a task of its own.
class PixKeysScreen extends StatelessWidget {
  /// Creates the screen; the router says where back goes.
  const new({required this.onBack, super.key});

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
                title: 'Minhas chaves',
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
