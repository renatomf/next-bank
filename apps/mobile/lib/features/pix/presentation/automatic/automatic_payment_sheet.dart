import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:next_bank/core/profile/profile_controller.dart';
import 'package:next_bank/features/pix/presentation/automatic/example_automatic_payments.dart';

/// Opens the details of [payment] in a sheet over the screen.
Future<void> showAutomaticPaymentSheet(
  BuildContext context,
  ExampleAutomaticPayment payment,
) => showModalBottomSheet<void>(
  context: context,
  isScrollControlled: true,
  builder: (_) => AutomaticPaymentSheet(payment: payment),
);

/// The details of an account in Pix Automático (v1.1.0 plan, task 4.7),
/// layout only: the company on top with the X, then one line per detail.
/// The payer is the customer, the CPF as the server masks it (READ-02).
/// Definir, the category and Abrir say they are coming.
class AutomaticPaymentSheet extends ConsumerWidget {
  /// Creates the sheet for [payment].
  const new({required this.payment, super.key});

  /// The account shown.
  final ExampleAutomaticPayment payment;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(profileProvider).value;
    void sayComingSoon() =>
        showNbToast(context, 'Em breve.', icon: Icons.info_outline);

    return SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(NbSpace.screen),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          spacing: NbSpace.lg,
          children: [
            _CompanyHeader(payment: payment),
            const Divider(),
            _DetailRow(label: 'Valor', value: Text(payment.amount)),
            _DetailRow(
              label: 'Frequência',
              value: _IconValue(
                icon: Icons.calendar_today_outlined,
                text: payment.frequency,
              ),
            ),
            _DetailRow(
              label: 'Informações adicionais',
              value: Text(payment.description),
            ),
            _DetailRow(label: 'Pagador', value: Text(profile?.name ?? '')),
            _DetailRow(label: 'CPF', value: Text(profile?.cpfMasked ?? '')),
            const _DetailRow(
              label: 'Pagamento após vencimento',
              value: _IconValue(
                icon: Icons.check_circle_outline,
                text: 'Autorizado',
              ),
            ),
            _DetailRow(
              label: 'Valor mínimo de pagamento',
              value: Text(payment.minimum),
            ),
            _DetailRow(
              label: 'Valor máximo de pagamento',
              value: _EditButton(label: 'Definir', onPressed: sayComingSoon),
            ),
            _DetailRow(
              label: 'Categoria',
              value: _EditButton(
                label: 'Contas de casa',
                onPressed: sayComingSoon,
              ),
            ),
            _DetailRow(
              label: 'Comprovante de autorização',
              value: TextButton(
                onPressed: sayComingSoon,
                child: const Text('Abrir'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// The company's icon, name and a CNPJ of zeros, plainly made up, with the
/// X that closes the sheet.
class _CompanyHeader extends StatelessWidget {
  const new({required this.payment});

  final ExampleAutomaticPayment payment;

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;

    return Row(
      children: [
        Container(
          width: 48,
          height: 48,
          decoration: BoxDecoration(
            color: colors.surface2,
            shape: BoxShape.circle,
          ),
          child: Icon(payment.icon, size: NbSize.icon, color: colors.accent),
        ),
        const SizedBox(width: NbSpace.md),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Semantics(
                header: true,
                child: Text(
                  payment.company,
                  style: context.nbText.sectionTitle,
                ),
              ),
              Text('CNPJ 00.000.000/0000-00', style: context.nbText.caption),
            ],
          ),
        ),
        IconCircleButton(
          icon: Icons.close,
          label: 'Fechar',
          onPressed: () => Navigator.of(context).pop(),
        ),
      ],
    );
  }
}

/// A detail: its name on the start, its value on the end.
class _DetailRow extends StatelessWidget {
  const new({required this.label, required this.value});

  final String label;
  final Widget value;

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;

    return Row(
      children: [
        Expanded(
          child: Text(
            label,
            style: context.nbText.bodyText.copyWith(color: colors.textMuted),
          ),
        ),
        const SizedBox(width: NbSpace.md),
        // The value takes the room it needs, wrapping when long.
        Flexible(
          child: Align(
            alignment: Alignment.centerRight,
            child: DefaultTextStyle.merge(
              textAlign: TextAlign.end,
              style: context.nbText.bodyText,
              child: value,
            ),
          ),
        ),
      ],
    );
  }
}

/// A value with an icon in the success color before it, such as
/// "Autorizado"; the text wraps when the room is short.
class _IconValue extends StatelessWidget {
  const new({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) => Row(
    mainAxisSize: MainAxisSize.min,
    spacing: NbSpace.xs,
    children: [
      Icon(icon, size: 18, color: context.nbColors.success),
      Flexible(child: Text(text)),
    ],
  );
}

/// A tonal button with a pencil, for a detail the customer can change.
class _EditButton extends StatelessWidget {
  const new({required this.label, required this.onPressed});

  final String label;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) => FilledButton.tonalIcon(
    onPressed: onPressed,
    icon: const Icon(Icons.edit_outlined, size: 18),
    label: Text(label),
    iconAlignment: IconAlignment.end,
  );
}
