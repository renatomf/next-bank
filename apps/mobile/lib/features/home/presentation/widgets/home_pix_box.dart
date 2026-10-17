import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:next_bank/core/cpf.dart';
import 'package:next_bank/core/cpf_input_formatter.dart';

/// One size for every icon of the box (developer's call at the checkpoint).
const double _iconSize = 22;

/// The Home's Pix box (v1.1.0 plan, task 4.2): a CPF key that opens the Pix
/// filled in, the three main Pix actions, the customer's CPF key line and the
/// way to Pix Automático and Minhas chaves. Only a valid CPF reaches the
/// lookup (PIX-07); the screens it opens say who receives (PIX-11).
class HomePixBox extends StatefulWidget {
  /// Creates the box; the Home says where each action goes.
  const new({
    required this.cpfMasked,
    required this.onPix,
    required this.onPixWithKey,
    required this.onTransfer,
    required this.onPay,
    required this.onReceive,
    required this.onAutomatic,
    required this.onKeys,
    super.key,
  });

  /// The customer's CPF as the server masks it; null while the profile loads.
  final String? cpfMasked;

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
        borderRadius: BorderRadius.circular(NbRadius.box),
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
                    // Smaller, so the whole hint fits the field.
                    hintStyle: NbType.caption.copyWith(color: colors.textMuted),
                    filled: true,
                    fillColor: colors.surface2,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(NbRadius.boxInner),
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
                  borderRadius: BorderRadius.circular(NbRadius.boxInner),
                  child: InkWell(
                    onTap: _continue,
                    borderRadius: BorderRadius.circular(NbRadius.boxInner),
                    child: SizedBox.square(
                      dimension: 52,
                      child: Icon(
                        Icons.chevron_right,
                        size: _iconSize,
                        color: colors.onPrimary,
                      ),
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
              (
                const Icon(Icons.swap_horiz, size: _iconSize),
                'Transferir Pix',
                'Transferir\nPix',
                widget.onTransfer,
              ),
              (
                const Icon(Icons.qr_code_scanner, size: _iconSize),
                'Pagar QR Code',
                'Pagar\nQR Code',
                widget.onPay,
              ),
              (
                const Icon(Icons.qr_code_2, size: _iconSize),
                'Gerar QR Code',
                'Gerar\nQR Code',
                widget.onReceive,
              ),
            ],
          ),
          const SizedBox(height: NbSpace.md),
          _CpfKeyLine(cpfMasked: widget.cpfMasked),
          const SizedBox(height: NbSpace.sm),
          // One row, split by a line, as in the reference.
          IntrinsicHeight(
            child: Row(
              children: [
                Expanded(
                  child: _BoxLink(
                    icon: const PixMark(size: _iconSize),
                    label: 'Pix Automático',
                    text: 'Pix\nAutomático',
                    onPressed: widget.onAutomatic,
                  ),
                ),
                VerticalDivider(
                  width: 1,
                  indent: NbSpace.sm,
                  endIndent: NbSpace.sm,
                  color: colors.border,
                ),
                Expanded(
                  child: _BoxLink(
                    icon: const Icon(Icons.key_outlined, size: _iconSize),
                    label: 'Minhas chaves',
                    text: 'Minhas\nchaves',
                    onPressed: widget.onKeys,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// The three main actions, side by side and split by thin lines. Each one is
/// read by its one-line label, and shows its two-line text.
class _PixActions extends StatelessWidget {
  const new({required this.actions});

  final List<(Widget, String, String, VoidCallback)> actions;

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.surface2,
        borderRadius: BorderRadius.circular(NbRadius.boxInner),
      ),
      child: IntrinsicHeight(
        child: Row(
          children: [
            for (final (index, (icon, label, text, onPressed))
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
                    borderRadius: BorderRadius.circular(NbRadius.boxInner),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                        vertical: NbSpace.md,
                        horizontal: NbSpace.xs,
                      ),
                      child: Column(
                        children: [
                          IconTheme.merge(
                            data: IconThemeData(color: colors.accent),
                            child: icon,
                          ),
                          const SizedBox(height: NbSpace.xs),
                          Text(
                            text,
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

/// The customer's CPF, masked by the server, and "Cadastrar" apart on the end:
/// only its layout for now (developer's call).
class _CpfKeyLine extends StatelessWidget {
  const new({required this.cpfMasked});

  final String? cpfMasked;

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;
    final cpf = cpfMasked;
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: NbSpace.md,
        vertical: NbSpace.sm,
      ),
      decoration: BoxDecoration(
        color: colors.surface2,
        borderRadius: BorderRadius.circular(NbRadius.boxInner),
      ),
      child: Row(
        children: [
          Expanded(
            child: Row(
              children: [
                Icon(
                  Icons.badge_outlined,
                  size: _iconSize,
                  color: colors.textMuted,
                ),
                const SizedBox(width: NbSpace.md),
                Flexible(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'CPF',
                        style: NbType.bodyText.copyWith(color: colors.text),
                      ),
                      if (cpf != null)
                        Text(
                          cpf,
                          style: NbType.caption.copyWith(
                            color: colors.textMuted,
                          ),
                        ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          // No action yet (developer's call): only the layout. On the end,
          // shrinking only on a narrow screen with large text.
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

/// A link at the foot of the box: its icon beside a two-line text, read by
/// its one-line label.
class _BoxLink extends StatelessWidget {
  const new({
    required this.icon,
    required this.label,
    required this.text,
    required this.onPressed,
  });

  final Widget icon;
  final String label;
  final String text;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;
    return Semantics(
      button: true,
      label: label,
      excludeSemantics: true,
      child: InkWell(
        onTap: onPressed,
        borderRadius: BorderRadius.circular(NbRadius.boxInner),
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: NbSpace.sm,
            vertical: NbSpace.sm,
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              IconTheme.merge(
                data: IconThemeData(color: colors.accent),
                child: icon,
              ),
              const SizedBox(width: NbSpace.sm),
              Flexible(
                child: Text(
                  text,
                  style: NbType.caption.copyWith(color: colors.accent),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
