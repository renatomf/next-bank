import 'dart:async';

import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:next_bank/core/ui/common_copy.dart';
import 'package:next_bank/core/ui/pix/contact_card.dart';
import 'package:next_bank/features/pix/domain/pix_schedule.dart';
import 'package:next_bank/features/pix/presentation/pix_formats.dart';
import 'package:next_bank/features/pix/presentation/schedule_detail/schedule_detail_controller.dart';
import 'package:next_bank/features/pix/presentation/schedule_texts.dart';

/// A scheduled Pix (v1.2.0 plan, task 7; D11): what it pays, when, what each
/// occurrence became, each with its receipt, and "Cancelar agendamento"
/// while it is active (S6).
class ScheduleDetailScreen extends ConsumerWidget {
  /// Creates the detail of the schedule [scheduleId].
  const new({
    required this.scheduleId,
    required this.onBack,
    required this.onReceipt,
    super.key,
  });

  /// The schedule shown.
  final String scheduleId;

  /// Back to where it was opened from.
  final VoidCallback onBack;

  /// Opens the receipt of an occurrence's Pix.
  final ValueChanged<String> onReceipt;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final schedule = ref.watch(pixScheduleProvider(scheduleId));
    return Scaffold(
      body: GlowBackground(
        child: SafeArea(
          child: ListView(
            padding: const EdgeInsets.all(NbSpace.screen),
            children: [
              ScreenHeader(
                title: 'Agendamento',
                icon: Icons.arrow_back,
                iconLabel: 'Voltar',
                onPressed: onBack,
              ),
              const SizedBox(height: NbSpace.xl),
              ...switch (schedule) {
                AsyncData(value: final schedule) => [
                  _Schedule(schedule: schedule, onReceipt: onReceipt),
                  if (schedule.status == PixScheduleStatus.active) ...[
                    const SizedBox(height: NbSpace.xl),
                    _CancelButton(scheduleId: scheduleId),
                  ],
                ],
                AsyncError() => [
                  ErrorState(
                    retryLabel: CommonCopy.retry,
                    message: 'Não foi possível carregar o agendamento.',
                    onRetry: () =>
                        ref.invalidate(pixScheduleProvider(scheduleId)),
                  ),
                ],
                _ => const [
                  Center(
                    child: CircularProgressIndicator(
                      semanticsLabel: 'Carregando o agendamento',
                    ),
                  ),
                ],
              },
            ],
          ),
        ),
      ),
    );
  }
}

class _Schedule extends StatelessWidget {
  const new({required this.schedule, required this.onReceipt});

  final PixSchedule schedule;
  final ValueChanged<String> onReceipt;

  @override
  Widget build(BuildContext context) {
    final text = context.nbText;
    final badge = scheduleBadge(schedule.status);
    final next = schedule.nextOccurrenceDate;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Center(child: MoneyText(cents: schedule.amountCents)),
        if (badge != null) ...[
          const SizedBox(height: NbSpace.sm),
          Center(
            child: StatusBadge(tone: badge.$1, label: badge.$2),
          ),
        ],
        const SizedBox(height: NbSpace.xl),
        ContactCard(
          name: schedule.payee.name,
          detail: payeeDetail(schedule.payee),
        ),
        const SizedBox(height: NbSpace.lg),
        _Line(
          label: 'Frequência',
          value: recurrenceText(schedule.frequency, schedule.times),
        ),
        _Line(label: 'Primeiro', value: dayText(schedule.firstDate)),
        if (next != null) _Line(label: 'Próximo', value: dayText(next)),
        _Line(label: 'Último', value: dayText(schedule.lastOccurrenceDate)),
        if (schedule.description case final description?)
          _Line(label: 'Descrição', value: description),
        const SizedBox(height: NbSpace.xl),
        Text('Pagamentos', style: text.sectionTitle),
        const SizedBox(height: NbSpace.sm),
        if (schedule.occurrences.isEmpty)
          Text('Nenhum pagamento feito ainda.', style: text.caption)
        else
          for (final occurrence in schedule.occurrences)
            _OccurrenceRow(
              occurrence: occurrence,
              onTap: () => onReceipt(occurrence.transferId),
            ),
      ],
    );
  }
}

class _Line extends StatelessWidget {
  const new({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final text = context.nbText;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: NbSpace.xs),
      child: Row(
        spacing: NbSpace.md,
        children: [
          Expanded(child: Text(label, style: text.caption)),
          Flexible(
            child: Text(value, style: text.bodyText, textAlign: TextAlign.end),
          ),
        ],
      ),
    );
  }
}

/// An occurrence: its day and what its Pix became; it opens the receipt.
class _OccurrenceRow extends StatelessWidget {
  const new({required this.occurrence, required this.onTap});

  final ScheduleOccurrence occurrence;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final (tone, label) = occurrenceBadge(occurrence);
    final day = dayText(occurrence.date);
    return Semantics(
      container: true,
      button: true,
      label: 'Pagamento de $day, $label. Ver o Pix',
      excludeSemantics: true,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(NbRadius.field),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: NbSpace.sm),
          child: Row(
            spacing: NbSpace.md,
            children: [
              // The day above its outcome: a reason does not fit beside it.
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  spacing: NbSpace.xs,
                  children: [
                    Text(day, style: context.nbText.bodyText),
                    StatusBadge(tone: tone, label: label),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right),
            ],
          ),
        ),
      ),
    );
  }
}

class _CancelButton extends ConsumerWidget {
  const new({required this.scheduleId});

  final String scheduleId;

  Future<void> _cancel(BuildContext context, WidgetRef ref) async {
    final confirmed = await showConfirmDialog(
      context,
      title: 'Cancelar agendamento?',
      message:
          'Os próximos pagamentos não serão feitos. Os que já foram feitos '
          'continuam valendo.',
      confirmLabel: 'Cancelar agendamento',
      cancelLabel: 'Manter',
    );
    if (!confirmed || !context.mounted) return;
    final done = await ref
        .read(cancelScheduleControllerProvider(scheduleId).notifier)
        .cancel();
    if (done && context.mounted) {
      showNbToast(context, 'Agendamento cancelado.', icon: Icons.check);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(cancelScheduleControllerProvider(scheduleId));
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (state.error case final error?) ...[
          FormErrorText(error),
          const SizedBox(height: NbSpace.md),
        ],
        SecondaryButton(
          label: 'Cancelar agendamento',
          onPressed: state.cancelling
              ? null
              : () => unawaited(_cancel(context, ref)),
        ),
      ],
    );
  }
}
