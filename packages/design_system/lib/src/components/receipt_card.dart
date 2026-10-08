import 'package:design_system/src/theme.dart';
import 'package:design_system/src/tokens.dart';
import 'package:flutter/material.dart';

/// One side of a transfer on a receipt: who, and how they are identified.
typedef ReceiptParty = ({String name, String detail});

/// The receipt of a transfer (brief, section 7; comprovante-dark mockup):
/// date and status, dashed dividers, payer, payee, type, description and the
/// transaction id in a monospaced font, so it can be read out unambiguously.
class ReceiptCard extends StatelessWidget {
  /// Creates the receipt; a null [description] or [transactionId] is left
  /// out.
  const new({
    required this.date,
    required this.status,
    required this.from,
    required this.to,
    required this.type,
    this.description,
    this.transactionId,
    super.key,
  });

  /// When it happened, already formatted, e.g. "5 out 2026 · 14:32".
  final String date;

  /// The status badge.
  final Widget status;

  /// Who paid.
  final ReceiptParty from;

  /// Who received.
  final ReceiptParty to;

  /// The kind of transfer, e.g. "Pix · Chave CPF".
  final String type;

  /// What the payer wrote.
  final String? description;

  /// The end-to-end id.
  final String? transactionId;

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;
    final description = this.description;
    final transactionId = this.transactionId;
    return Container(
      padding: const EdgeInsets.all(NbSpace.screen),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(NbRadius.card),
        border: Border.all(color: colors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  date,
                  style: NbType.captionPlain.copyWith(color: colors.textMuted),
                ),
              ),
              status,
            ],
          ),
          const _DashedDivider(),
          _Party(label: 'DE', party: from),
          const SizedBox(height: NbSpace.lg),
          _Party(label: 'PARA', party: to),
          const SizedBox(height: NbSpace.lg),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: _Field(label: 'TIPO', value: type),
              ),
              if (description != null) ...[
                const SizedBox(width: NbSpace.lg),
                Expanded(
                  child: _Field(label: 'DESCRIÇÃO', value: description),
                ),
              ],
            ],
          ),
          if (transactionId != null) ...[
            const _DashedDivider(),
            _Field(
              label: 'ID DA TRANSAÇÃO',
              value: transactionId,
              // The id is read out to support: a monospaced font keeps
              // 0 and O, 1 and l apart.
              // The platform's own monospaced font: a new style, since one
              // from NbType would look for it inside this package.
              valueStyle: TextStyle(
                fontFamily: 'monospace',
                fontFamilyFallback: const ['Courier'],
                fontSize: 14,
                color: colors.text,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _Party extends StatelessWidget {
  const new({required this.label, required this.party});

  final String label;
  final ReceiptParty party;

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;
    return MergeSemantics(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _Label(label),
          const SizedBox(height: NbSpace.xs),
          Text(
            party.name,
            style: NbType.bodyStrong.copyWith(color: colors.text),
          ),
          const SizedBox(height: 2),
          Text(
            party.detail,
            style: NbType.caption.copyWith(color: colors.textMuted),
          ),
        ],
      ),
    );
  }
}

class _Field extends StatelessWidget {
  const new({required this.label, required this.value, this.valueStyle});

  final String label;
  final String value;
  final TextStyle? valueStyle;

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;
    return MergeSemantics(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _Label(label),
          const SizedBox(height: NbSpace.xs),
          Text(
            value,
            style: valueStyle ?? NbType.bodyText.copyWith(color: colors.text),
          ),
        ],
      ),
    );
  }
}

class _Label extends StatelessWidget {
  const new(this.text);

  final String text;

  @override
  Widget build(BuildContext context) => Text(
    text,
    style: NbType.caption.copyWith(
      color: context.nbColors.textMuted,
      letterSpacing: 1.2,
    ),
  );
}

class _DashedDivider extends StatelessWidget {
  const new();

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: NbSpace.lg),
    child: CustomPaint(
      size: const Size(double.infinity, 1),
      painter: _DashesPainter(
        context.nbColors.textMuted.withValues(alpha: 0.4),
      ),
    ),
  );
}

class _DashesPainter extends CustomPainter {
  const new(this.color);

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..strokeWidth = 1;
    const dash = 5.0;
    const gap = 4.0;
    for (var x = 0.0; x < size.width; x += dash + gap) {
      canvas.drawLine(Offset(x, 0), Offset(x + dash, 0), paint);
    }
  }

  @override
  bool shouldRepaint(_DashesPainter oldDelegate) => oldDelegate.color != color;
}
