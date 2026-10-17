import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:next_bank/core/cpf.dart';
import 'package:next_bank/core/cpf_input_formatter.dart';
import 'package:next_bank/features/home/presentation/pix_box/pix_box.dart';

/// "Digite ou cole uma chave CPF" and its › button:
/// - empty, it opens the Pix area;
/// - with a valid CPF, the Pix filled in with it;
/// - with an invalid one, it says so, and no lookup is spent (PIX-07).
class PixKeyField extends StatefulWidget {
  /// Creates the field.
  const new({required this.onPix, required this.onPixWithKey, super.key});

  /// Opens the Pix area.
  final VoidCallback onPix;

  /// Opens the Pix with a valid CPF key, in digits.
  final ValueChanged<String> onPixWithKey;

  @override
  State<PixKeyField> createState() => _PixKeyFieldState();
}

class _PixKeyFieldState extends State<PixKeyField> {
  final _cpf = TextEditingController();
  String? _error;

  @override
  void dispose() {
    _cpf.dispose();
    super.dispose();
  }

  void _continue() {
    final typed = _cpf.text.trim();

    if (typed.isEmpty) {
      widget.onPix();
      return;
    }
    if (!isValidCpf(typed)) {
      setState(() => _error = 'CPF inválido.');
      return;
    }

    setState(() => _error = null);
    final digits = typed.replaceAll(RegExp(r'\D'), '');
    widget.onPixWithKey(digits);
  }

  void _clearError(String _) {
    if (_error != null) setState(() => _error = null);
  }

  @override
  Widget build(BuildContext context) {
    final error = _error;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Expanded(
              child: _CpfInput(
                controller: _cpf,
                onChanged: _clearError,
                onSubmitted: _continue,
              ),
            ),
            const SizedBox(width: NbSpace.sm),
            _ContinueButton(onPressed: _continue),
          ],
        ),
        if (error != null) ...[
          const SizedBox(height: NbSpace.sm),
          FormErrorText(error),
        ],
      ],
    );
  }
}

/// The CPF field: digits only, masked as they are typed (task 1.1).
class _CpfInput extends StatelessWidget {
  const new({
    required this.controller,
    required this.onChanged,
    required this.onSubmitted,
  });

  final TextEditingController controller;
  final ValueChanged<String> onChanged;
  final VoidCallback onSubmitted;

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;

    return TextField(
      controller: controller,
      keyboardType: TextInputType.number,
      textInputAction: TextInputAction.go,
      inputFormatters: const [CpfInputFormatter()],
      onChanged: onChanged,
      onSubmitted: (_) => onSubmitted(),
      decoration: InputDecoration(
        hintText: 'Digite ou cole uma chave CPF',
        // A smaller hint, so all of it fits the field.
        hintStyle: NbType.caption.copyWith(color: colors.textMuted),
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
              size: pixBoxIconSize,
              color: colors.onPrimary,
            ),
          ),
        ),
      ),
    );
  }
}
