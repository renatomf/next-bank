import 'package:design_system/src/theme.dart';
import 'package:design_system/src/tokens.dart';
import 'package:flutter/material.dart';

/// A card's lock, switching between "Desbloqueado" and "Bloqueado" (v1.1.0
/// plan, task 4.15). On the screen only for now: nothing reaches the
/// server, which will hold the card's real state.
class CardLockToggle extends StatefulWidget {
  /// Creates the lock, the card unlocked.
  const new({super.key});

  @override
  State<CardLockToggle> createState() => _CardLockToggleState();
}

class _CardLockToggleState extends State<CardLockToggle> {
  bool _locked = false;

  void _toggle() => setState(() => _locked = !_locked);

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;
    final label = _locked ? 'Bloqueado' : 'Desbloqueado';

    return Semantics(
      container: true,
      button: true,
      toggled: _locked,
      label: label,
      onTap: _toggle,
      excludeSemantics: true,
      child: InkWell(
        onTap: _toggle,
        borderRadius: BorderRadius.circular(NbRadius.boxInner),
        child: ConstrainedBox(
          constraints: const BoxConstraints(
            minHeight: kMinInteractiveDimension,
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            spacing: NbSpace.sm,
            children: [
              Icon(
                _locked ? Icons.lock : Icons.lock_open,
                size: NbSize.icon,
                color: _locked ? colors.danger : colors.success,
              ),
              Flexible(
                child: Text(
                  label,
                  style: NbType.bodyText.copyWith(color: colors.text),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
