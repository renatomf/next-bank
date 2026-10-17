import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:next_bank/core/cpf.dart';
import 'package:next_bank/core/cpf_input_formatter.dart';

/// The Home's Pix box (v1.1.0 plan, task 4.2): a CPF key that opens the Pix
/// filled in, the three main Pix actions, the CPF key line and the way to
/// Pix Automático and Minhas chaves. Only a valid CPF reaches the lookup
/// (PIX-07); the screens it opens say who receives (PIX-11).
class HomePixBox extends StatefulWidget {
  /// Creates the box; the Home says where each action goes.
  const new({
    required this.onPix,
    required this.onPixWithKey,
    required this.onTransfer,
    required this.onPay,
    required this.onReceive,
    required this.onAutomatic,
    required this.onKeys,
    super.key,
  });

  /// Opens the Pix area, when no key was typed.
  final VoidCallback onPix;

  /// Opens the Pix with a valid CPF key, in digits.
  final ValueChanged<String> onPixWithKey;

  /// Opens "Transferir Pix".
  final VoidCallback onTransfer;

  /// Opens the reading of a Pix QR Code.
  final VoidCallback onPay;

  /// Opens "Receber", with the customer's QR Code.
  final VoidCallback onReceive;

  /// Opens "Pix Automático".
  final VoidCallback onAutomatic;

  /// Opens "Minhas chaves".
  final VoidCallback onKeys;

  @override
  State<HomePixBox> createState() => _HomePixBoxState();
}

class _HomePixBoxState extends State<HomePixBox> {
  final _key = TextEditingController();
  String? _error;

  @override
  void dispose() {
    _key.dispose();
    super.dispose();
  }

  void _continue() {
    final typed = _key.text.trim();
    if (typed.isEmpty) {
      widget.onPix();
      return;
    }
    // An invalid CPF never reaches the API: no lookup is spent (PIX-07).
    if (!isValidCpf(typed)) {
      setState(() => _error = 'CPF inválido.');
      return;
    }
    setState(() => _error = null);
    widget.onPixWithKey(typed.replaceAll(RegExp(r'\D'), ''));
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;
    final text = Theme.of(context).textTheme;
    final error = _error;
    return Container(
      padding: const EdgeInsets.all(NbSpace.lg),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(NbRadius.card),
        border: Border.all(color: colors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Semantics(header: true, child: Text('Pix', style: text.titleMedium)),
          const SizedBox(height: NbSpace.md),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _key,
                  keyboardType: TextInputType.number,
                  textInputAction: TextInputAction.go,
                  // Digits only; the mask shows as they are typed (task 1.1).
                  inputFormatters: const [CpfInputFormatter()],
                  onChanged: (_) {
                    if (_error != null) setState(() => _error = null);
                  },
                  onSubmitted: (_) => _continue(),
                  decoration: InputDecoration(
                    hintText: 'Digite ou cole uma chave CPF',
                    filled: true,
                    fillColor: colors.surface2,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(NbRadius.block),
                      borderSide: BorderSide.none,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: NbSpace.sm),
              Semantics(
                button: true,
                label: 'Continuar com a chave',
                excludeSemantics: true,
                child: Material(
                  color: colors.primary,
                  borderRadius: BorderRadius.circular(NbRadius.block),
                  child: InkWell(
                    onTap: _continue,
                    borderRadius: BorderRadius.circular(NbRadius.block),
                    child: SizedBox.square(
                      dimension: 52,
                      child: Icon(Icons.chevron_right, color: colors.onPrimary),
                    ),
                  ),
                ),
              ),
            ],
          ),
          if (error != null) ...[
            const SizedBox(height: NbSpace.sm),
            FormErrorText(error),
          ],
          const SizedBox(height: NbSpace.md),
          _PixActions(
            actions: [
              (Icons.swap_horiz, 'Transferir Pix', widget.onTransfer),
              (Icons.qr_code_scanner, 'Pagar QR Code', widget.onPay),
              (Icons.qr_code_2, 'Gerar QR Code', widget.onReceive),
            ],
          ),
          const SizedBox(height: NbSpace.md),
          const _CpfKeyLine(),
          const SizedBox(height: NbSpace.sm),
          // Side by side, or one under the other on a narrow screen with
          // large text.
          Wrap(
            alignment: WrapAlignment.spaceAround,
            children: [
              _BoxLink(
                icon: Icons.autorenew,
                label: 'Pix Automático',
                onPressed: widget.onAutomatic,
              ),
              _BoxLink(
                icon: Icons.key_outlined,
                label: 'Minhas chaves',
                onPressed: widget.onKeys,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// The three main actions, side by side and split by thin lines.
class _PixActions extends StatelessWidget {
  const new({required this.actions});

  final List<(IconData, String, VoidCallback)> actions;

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.surface2,
        borderRadius: BorderRadius.circular(NbRadius.block),
      ),
      child: IntrinsicHeight(
        child: Row(
          children: [
            for (final (index, (icon, label, onPressed))
                in actions.indexed) ...[
              if (index > 0)
                VerticalDivider(
                  width: 1,
                  indent: NbSpace.md,
                  endIndent: NbSpace.md,
                  color: colors.border,
                ),
              Expanded(
                child: Semantics(
                  button: true,
                  label: label,
                  excludeSemantics: true,
                  child: InkWell(
                    onTap: onPressed,
                    borderRadius: BorderRadius.circular(NbRadius.block),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                        vertical: NbSpace.md,
                        horizontal: NbSpace.xs,
                      ),
                      child: Column(
                        children: [
                          Icon(icon, size: 22, color: colors.accent),
                          const SizedBox(height: NbSpace.xs),
                          Text(
                            label,
                            textAlign: TextAlign.center,
                            style: NbType.caption.copyWith(color: colors.text),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// The CPF key line, with "Cadastrar": only its layout for now (H1).
class _CpfKeyLine extends StatelessWidget {
  const new();

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: NbSpace.md,
        vertical: NbSpace.sm,
      ),
      decoration: BoxDecoration(
        color: colors.surface2,
        borderRadius: BorderRadius.circular(NbRadius.block),
      ),
      child: Row(
        children: [
          Icon(Icons.badge_outlined, color: colors.textMuted),
          const SizedBox(width: NbSpace.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'CPF',
                  style: NbType.bodyText.copyWith(color: colors.text),
                ),
                Text(
                  'Sua chave Pix principal',
                  style: NbType.caption.copyWith(color: colors.textMuted),
                ),
              ],
            ),
          ),
          // No action yet (developer's call): only the layout. Flexible and
          // compact, so a small phone with large text keeps it on the line.
          Flexible(
            child: TextButton(
              onPressed: () {},
              style: TextButton.styleFrom(
                padding: const EdgeInsets.symmetric(horizontal: NbSpace.sm),
              ),
              child: const Text(
                'Cadastrar',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// A link at the foot of the box: an icon and its label.
class _BoxLink extends StatelessWidget {
  const new({required this.icon, required this.label, required this.onPressed});

  final IconData icon;
  final String label;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    label: label,
    excludeSemantics: true,
    child: TextButton.icon(
      onPressed: onPressed,
      icon: Icon(icon, size: 20),
      label: Text(label),
    ),
  );
}
