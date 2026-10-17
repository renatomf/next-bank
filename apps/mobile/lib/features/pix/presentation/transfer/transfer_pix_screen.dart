import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';

/// Transferring a Pix by agency and account or to another key: blank for
/// now, only its header and the way back (v1.1.0 plan, task 4.2); its layout
/// comes with a task of its own.
class TransferPixScreen extends StatelessWidget {
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
                title: 'Transferir Pix',
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
