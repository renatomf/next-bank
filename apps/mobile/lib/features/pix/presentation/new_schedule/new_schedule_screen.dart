import 'dart:async';

import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:next_bank/core/date_texts.dart';
import 'package:next_bank/core/ui/common_copy.dart';
import 'package:next_bank/core/ui/pix/contact_card.dart';
import 'package:next_bank/features/pix/domain/pix_schedule.dart';
import 'package:next_bank/features/pix/presentation/new_schedule/new_schedule_controller.dart';
import 'package:next_bank/features/pix/presentation/schedule_texts.dart';

/// Scheduling a Pix (v1.2.0 plan, task 7; D11), opened from "Agendar" on
/// the Pix screen: the day, once or every month, then the PIN, checked on
/// the server (D10), which authorizes every occurrence.
class NewScheduleScreen extends ConsumerStatefulWidget {
  /// Creates the scheduling of the [draft]; the router says where each
  /// outcome goes.
  const new({
    required this.draft,
    required this.onBack,
    required this.onHome,
    required this.onDone,
    super.key,
  });

  /// What is being scheduled.
  final ScheduleDraft draft;

  /// Back to the Pix screen, to change it.
  final VoidCallback onBack;

  /// Back to the Home.
  final VoidCallback onHome;

  /// The server kept the schedule.
  final ValueChanged<PixSchedule> onDone;

  @override
  ConsumerState<NewScheduleScreen> createState() => _NewScheduleScreenState();
}

class _NewScheduleScreenState extends ConsumerState<NewScheduleScreen> {
  final _pin = TextEditingController();

  @override
  void dispose() {
    _pin.dispose();
    super.dispose();
  }

  NewScheduleController get _controller =>
      ref.read(newScheduleControllerProvider(widget.draft).notifier);

  void _onCompleted(String pin) {
    // The field forgets the PIN at once; the controller keeps it only while
    // its attempt has no answer (MOB-02).
    _pin.clear();
    unawaited(_finish(_controller.confirm(pin)));
  }

  Future<void> _finish(Future<PixSchedule?> scheduling) async {
    final done = await scheduling;
    if (done != null && mounted) widget.onDone(done);
  }

  /// Leaves the scheduling. With an answer still lost the Pix may have been
  /// scheduled, so the customer is told first (F-39); opening the same one
  /// again brings back the same attempt.
  Future<void> _leave() async {
    final state = ref.read(newScheduleControllerProvider(widget.draft));
    if (state.outcomeUnknown) {
      final leave = await showConfirmDialog(
        context,
        title: 'O Pix pode ter sido agendado',
        message:
            'Não conseguimos confirmar o agendamento. Confira em '
            'Agendamentos antes de agendar de novo.',
        confirmLabel: 'Sair',
        cancelLabel: 'Ficar',
      );
      if (!leave || !mounted) return;
    }
    widget.onBack();
  }

  @override
  Widget build(BuildContext context) {
    final draft = widget.draft;
    final state = ref.watch(newScheduleControllerProvider(draft));
    return PopScope(
      canPop: !state.outcomeUnknown,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) unawaited(_leave());
      },
      child: Scaffold(
        body: GlowBackground(
          child: SafeArea(
            child: ListView(
              padding: const EdgeInsets.all(NbSpace.screen),
              children: [
                ScreenHeader(
                  title: 'Agendar Pix',
                  icon: Icons.arrow_back,
                  iconLabel: 'Voltar',
                  onPressed: () => unawaited(_leave()),
                ),
                const SizedBox(height: NbSpace.xl),
                Center(child: MoneyText(cents: draft.amountCents)),
                const SizedBox(height: NbSpace.xl),
                ContactCard(name: draft.payeeName, detail: draft.payeeDetail),
                const SizedBox(height: NbSpace.xl),
                ..._when(state),
                const SizedBox(height: NbSpace.xl),
                ..._confirmation(state),
              ],
            ),
          ),
        ),
      ),
    );
  }

  List<Widget> _when(NewScheduleState state) {
    final text = context.nbText;
    final editable = state.canConfirm || state.firstDate == null;
    final firstDate = state.firstDate;
    final lastDate = state.lastDate;
    return [
      Text(
        firstDate == null
            ? 'Escolha a data do primeiro Pix'
            : 'Primeiro Pix em ${dayText(firstDate)}',
        style: text.bodyStrong,
      ),
      const SizedBox(height: NbSpace.md),
      _DayPicker(
        earliest: state.earliest,
        latest: state.latest,
        selected: firstDate,
        onPicked: editable ? _controller.pickDate : null,
      ),
      const SizedBox(height: NbSpace.lg),
      Row(
        children: [
          Expanded(child: Text('Repetir todo mês', style: text.bodyText)),
          NbSwitch(
            value: state.monthly,
            onChanged: editable
                ? (monthly) => _controller.setMonthly(monthly: monthly)
                : null,
          ),
        ],
      ),
      if (state.monthly) ...[
        const SizedBox(height: NbSpace.md),
        Row(
          spacing: NbSpace.md,
          children: [
            Expanded(child: Text('Quantas vezes', style: text.bodyText)),
            IconCircleButton(
              icon: Icons.remove,
              label: 'Menos uma vez',
              onPressed: editable && state.times > minMonthlyTimes
                  ? () => _controller.setTimes(state.times - 1)
                  : null,
            ),
            Text('${state.times}', style: text.bodyStrong),
            IconCircleButton(
              icon: Icons.add,
              label: 'Mais uma vez',
              onPressed: editable && state.times < maxMonthlyTimes
                  ? () => _controller.setTimes(state.times + 1)
                  : null,
            ),
          ],
        ),
      ],
      if (lastDate != null && state.monthly) ...[
        const SizedBox(height: NbSpace.md),
        Text('Último Pix em ${dayText(lastDate)}', style: text.caption),
      ],
      const SizedBox(height: NbSpace.md),
      Text(
        'O Pix sai a partir das 6h da data, com o saldo e o limite do dia. '
        'Sem saldo, aquele pagamento não é feito e os próximos continuam.',
        style: text.caption,
      ),
    ];
  }

  List<Widget> _confirmation(NewScheduleState state) {
    final error = state.error;
    if (state.blocked) {
      return [
        InfoNotice(message: error ?? ''),
        const SizedBox(height: NbSpace.xl),
        SecondaryButton(label: 'Voltar ao início', onPressed: widget.onHome),
      ];
    }
    if (state.outcomeUnknown) {
      // The same attempt goes again: never a new PIN, never a second schedule.
      return [
        InfoNotice(message: error ?? ''),
        const SizedBox(height: NbSpace.xl),
        PrimaryButton(
          label: CommonCopy.retry,
          onPressed: () => unawaited(_finish(_controller.retry())),
          loading: state.verifying,
        ),
      ];
    }
    return [
      PinField(
        revealLabels: CommonCopy.revealSecret,
        label: 'Digite seu PIN para agendar',
        controller: _pin,
        errorText: error,
        onCompleted: _onCompleted,
        enabled: state.canConfirm,
      ),
      const SizedBox(height: NbSpace.lg),
      if (state.verifying)
        const Center(
          child: CircularProgressIndicator(semanticsLabel: 'Agendando o Pix'),
        )
      else
        const SecureHint(
          text: 'Seu PIN é conferido no servidor e autoriza cada pagamento',
        ),
    ];
  }
}

/// The days of one month that can be chosen, with arrows to the months
/// around it: composed of the app's chips, so the calendar speaks
/// Portuguese without a localization package.
class _DayPicker extends StatefulWidget {
  const new({
    required this.earliest,
    required this.latest,
    required this.selected,
    required this.onPicked,
  });

  final CalendarDay earliest;
  final CalendarDay latest;
  final CalendarDay? selected;

  /// Null while the date cannot change.
  final ValueChanged<CalendarDay>? onPicked;

  @override
  State<_DayPicker> createState() => _DayPickerState();
}

class _DayPickerState extends State<_DayPicker> {
  /// The month shown, as its first day.
  late CalendarDay _month = _firstOf(widget.selected ?? widget.earliest);

  static CalendarDay _firstOf(CalendarDay day) =>
      CalendarDay(day.year, day.month, 1);

  CalendarDay _shift(int months) => _month.monthly(months + 1);

  bool get _hasPrevious => _shift(-1).compareTo(_firstOf(widget.earliest)) >= 0;

  bool get _hasNext => _shift(1).compareTo(widget.latest) <= 0;

  @override
  Widget build(BuildContext context) {
    final text = context.nbText;
    final onPicked = widget.onPicked;
    final lastDay = DateTime.utc(_month.year, _month.month + 1, 0).day;
    final days =
        [
          for (var day = 1; day <= lastDay; day++)
            CalendarDay(_month.year, _month.month, day),
        ].where(
          (day) =>
              day.compareTo(widget.earliest) >= 0 &&
              day.compareTo(widget.latest) <= 0,
        );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            IconCircleButton(
              icon: Icons.chevron_left,
              label: 'Mês anterior',
              onPressed: _hasPrevious
                  ? () => setState(() => _month = _shift(-1))
                  : null,
            ),
            Expanded(
              child: Text(
                '${longMonth(_month.month)} de ${_month.year}',
                style: text.bodyStrong,
                textAlign: TextAlign.center,
              ),
            ),
            IconCircleButton(
              icon: Icons.chevron_right,
              label: 'Próximo mês',
              onPressed: _hasNext
                  ? () => setState(() => _month = _shift(1))
                  : null,
            ),
          ],
        ),
        const SizedBox(height: NbSpace.md),
        Wrap(
          spacing: NbSpace.sm,
          runSpacing: NbSpace.sm,
          children: [
            for (final day in days)
              FilterPill(
                label: '${day.day}',
                selected: day == widget.selected,
                onPressed: () => onPicked?.call(day),
              ),
          ],
        ),
      ],
    );
  }
}
