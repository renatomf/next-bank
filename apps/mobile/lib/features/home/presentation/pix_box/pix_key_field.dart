import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';

/// "Digite ou cole uma chave Pix" and its › button:
/// - empty, it opens the Pix area;
/// - with a key of any kind, the Pix filled in with it, as typed. The Pix
///   screen tells its kind and refuses a value that is no key before any
///   lookup (v1.2.0 plan, task 5, A1; PIX-07).
class PixKeyField extends StatefulWidget {
  /// Creates the field.
  const new({required this.onPix, required this.onPixWithKey, super.key});

  /// Opens the Pix area.
  final VoidCallback onPix;

  /// Opens the Pix with the key typed.
  final ValueChanged<String> onPixWithKey;

  @override
  State<PixKeyField> createState() => _PixKeyFieldState();
}

class _PixKeyFieldState extends State<PixKeyField> {
  final _key = TextEditingController();

  @override
  void dispose() {
    _key.dispose();
    super.dispose();
  }

  void _continue() {
    final typed = _key.text.trim();
    if (typed.isEmpty) {
      widget.onPix();
    } else {
      widget.onPixWithKey(typed);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: _KeyInput(controller: _key, onSubmitted: _continue),
        ),
        const SizedBox(width: NbSpace.sm),
        _ContinueButton(onPressed: _continue),
      ],
    );
  }
}

/// The key field: CPF, e-mail, phone or random key, as typed (A1); the
/// e-mail keyboard has the "@" and the digits.
class _KeyInput extends StatelessWidget {
  const new({required this.controller, required this.onSubmitted});

  final TextEditingController controller;
  final VoidCallback onSubmitted;

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;

    return TextField(
      controller: controller,
      keyboardType: TextInputType.emailAddress,
      textInputAction: TextInputAction.go,
      onSubmitted: (_) => onSubmitted(),
      decoration: InputDecoration(
        hintText: 'Digite ou cole uma chave Pix',
        // A smaller hint, so all of it fits the field.
        hintStyle: context.nbText.caption,
        filled: true,
        fillColor: colors.surface2,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(NbRadius.boxInner),
          borderSide: BorderSide.none,
        ),
      ),
    );
  }
}

class _ContinueButton extends StatelessWidget {
  const new({required this.onPressed});

  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;
    final shape = BorderRadius.circular(NbRadius.boxInner);

    return Semantics(
      button: true,
      label: 'Continuar com a chave',
      excludeSemantics: true,
      child: Material(
        color: colors.primary,
        borderRadius: shape,
        child: InkWell(
          onTap: onPressed,
          borderRadius: shape,
          child: SizedBox.square(
            dimension: 52,
            child: Icon(
              Icons.chevron_right,
              size: NbSize.icon,
              color: colors.onPrimary,
            ),
          ),
        ),
      ),
    );
  }
}
