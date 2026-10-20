import 'dart:math' as math;

import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:next_bank/features/pix/domain/pix_transfer.dart';
import 'package:next_bank/features/pix/presentation/pix_formats.dart';

/// The receipt of a completed Pix as the image the customer shares (v1.1.0
/// plan, task 1): laid out like a bank receipt, in the light theme whatever
/// the app's theme, with only what the screen masks (MOB-09) and the demo
/// notice (DEMO-05).
class ShareableReceipt extends StatelessWidget {
  /// Creates the image of [transfer], which must be completed: a Pix still
  /// moving or refused would read as a payment that never was.
  new({
    required this.transfer,
    required this.payerName,
    required this.payerAccount,
    super.key,
  }) {
    if (transfer.status != PixStatus.completed) {
      throw ArgumentError.value(transfer.status, 'transfer', 'not completed');
    }
  }

  /// The image's width; it takes the height its content needs.
  static const double width = 360;

  /// The Pix on the receipt.
  final PixTransfer transfer;

  /// Who paid: the customer.
  final String payerName;

  /// The payer's account as the screen shows it ([payerDetail]).
  final String payerAccount;

  @override
  Widget build(BuildContext context) => Theme(
    data: NbTheme.light(),
    // Outside a screen there is no Material to set the text defaults.
    child: Material(
      type: MaterialType.transparency,
      child: Builder(builder: _paper),
    ),
  );

  Widget _paper(BuildContext context) {
    const colors = NbColors.light;
    final text = Theme.of(context).textTheme;
    final label = text.bodySmall?.copyWith(color: colors.textMuted);
    final value = text.bodyMedium?.copyWith(
      color: colors.text,
      fontWeight: FontWeight.w700,
    );
    final description = transfer.description;
    final endToEndId = transfer.endToEndId;
    final completedAt = transfer.completedAt ?? transfer.createdAt;

    Widget field(String name, String content) => Padding(
      padding: const EdgeInsets.only(bottom: NbSpace.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(name, style: label),
          const SizedBox(height: 2),
          Text(content, style: value),
        ],
      ),
    );

    return ColoredBox(
      color: colors.background,
      child: Padding(
        padding: const EdgeInsets.all(NbSpace.lg),
        child: ClipPath(
          clipper: const _TornEdges(),
          child: ColoredBox(
            color: colors.surface,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(
                NbSpace.xl,
                NbSpace.xxl,
                NbSpace.xl,
                NbSpace.xxl,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  const NextLogo(size: 26, color: Color(0xFF0A0F14)),
                  const SizedBox(height: NbSpace.xl),
                  _Timeline(
                    startedAt: receiptDate(transfer.createdAt),
                    completedAt: receiptDate(completedAt),
                  ),
                  const _Rule(),
                  _Party(
                    name: transfer.payee.name,
                    detail: payeeDetail(transfer.payee),
                  ),
                  const _Rule(),
                  if (endToEndId != null) field('ID da transação', endToEndId),
                  field('Valor', formatReais(transfer.amountCents).full),
                  field(
                    'Data e hora da transação',
                    receiptLongDate(completedAt),
                  ),
                  if (description != null) field('Descrição', description),
                  const _Rule(top: 0),
                  Text('Conta de origem', style: text.titleMedium),
                  const SizedBox(height: NbSpace.md),
                  _Party(name: payerName, detail: payerAccount),
                  const _Rule(),
                  Text(
                    demoReceiptNotice,
                    style: label,
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// "Pix em andamento" and "Pix realizado", with their times.
class _Timeline extends StatelessWidget {
  const new({required this.startedAt, required this.completedAt});

  final String startedAt;
  final String completedAt;

  @override
  Widget build(BuildContext context) {
    const colors = NbColors.light;
    final style = Theme.of(context).textTheme.bodySmall;

    Widget step(String title, String when) => Expanded(
      child: Column(
        children: [
          Container(
            width: 28,
            height: 28,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(color: colors.accent, width: 2),
            ),
            child: Icon(Icons.check, size: 16, color: colors.accent),
          ),
          const SizedBox(height: NbSpace.sm),
          Text(
            title,
            textAlign: TextAlign.center,
            style: style?.copyWith(
              color: colors.text,
              fontWeight: FontWeight.w700,
            ),
          ),
          Text(
            when,
            textAlign: TextAlign.center,
            style: style?.copyWith(color: colors.textMuted),
          ),
        ],
      ),
    );

    return Stack(
      children: [
        Positioned(
          top: 14,
          left: ShareableReceipt.width / 4,
          right: ShareableReceipt.width / 4,
          child: Container(height: 1, color: colors.border),
        ),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            step('Pix em andamento', startedAt),
            step('Pix realizado', completedAt),
          ],
        ),
      ],
    );
  }
}

/// Who paid or received: initials, name and the masked detail.
class _Party extends StatelessWidget {
  const new({required this.name, required this.detail});

  final String name;
  final String detail;

  @override
  Widget build(BuildContext context) {
    const colors = NbColors.light;
    final text = Theme.of(context).textTheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 40,
          height: 40,
          alignment: Alignment.center,
          decoration: const BoxDecoration(
            color: Color(0xFFE6EEEE),
            shape: BoxShape.circle,
          ),
          child: Text(
            nameInitials(name),
            style: text.bodySmall?.copyWith(
              color: colors.text,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
        const SizedBox(height: NbSpace.md),
        Text(name, style: context.nbText.bodyStrong),
        const SizedBox(height: 2),
        Text(detail, style: text.bodySmall?.copyWith(color: colors.textMuted)),
      ],
    );
  }
}

/// A thin line between the receipt's sections.
class _Rule extends StatelessWidget {
  const new({this.top = NbSpace.xl});

  final double top;

  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.only(top: top, bottom: NbSpace.xl),
    child: Container(height: 1, color: NbColors.light.border),
  );
}

/// The top and bottom edges torn like a paper slip.
class _TornEdges extends CustomClipper<Path> {
  const new();

  static const double _tooth = 8;

  @override
  Path getClip(Size size) {
    final path = Path()..moveTo(0, _tooth);
    for (var x = 0.0; x < size.width; x += _tooth * 2) {
      path
        ..lineTo(x + _tooth, 0)
        ..lineTo(math.min(x + _tooth * 2, size.width), _tooth);
    }
    path.lineTo(size.width, size.height - _tooth);
    for (var x = size.width; x > 0; x -= _tooth * 2) {
      path
        ..lineTo(x - _tooth, size.height)
        ..lineTo(math.max(x - _tooth * 2, 0), size.height - _tooth);
    }
    return path..close();
  }

  @override
  bool shouldReclip(_TornEdges oldClipper) => false;
}
