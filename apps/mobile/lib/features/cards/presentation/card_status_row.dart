import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';

/// Whether the card is locked, with the way to switch it (S21 checkpoint of
/// v1.1.0, task 4.14). On the screen only for now: nothing reaches the
/// server, which will hold the card's real state.
class CardStatusRow extends StatefulWidget {
  /// Creates the row, the card unlocked.
  const new({super.key});

  @override
  State<CardStatusRow> createState() => _CardStatusRowState();
}

class _CardStatusRowState extends State<CardStatusRow> {
  bool _locked = false;

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;

    return NbSurface(
      tone: NbSurfaceTone.outlined,
      padding: const EdgeInsets.symmetric(horizontal: NbSpace.lg),
      child: Row(
        spacing: NbSpace.md,
        children: [
          Icon(
            _locked ? Icons.lock : Icons.lock_open,
            size: NbSize.icon,
            color: _locked ? colors.danger : colors.success,
          ),
          Expanded(
            child: Text(
              _locked ? 'Cartão bloqueado' : 'Cartão desbloqueado',
              style: context.nbText.bodyText,
            ),
          ),
          TextButton(
            onPressed: () => setState(() => _locked = !_locked),
            child: Text(_locked ? 'Desbloquear' : 'Bloquear'),
          ),
        ],
      ),
    );
  }
}
