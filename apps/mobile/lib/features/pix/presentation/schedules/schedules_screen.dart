import 'dart:async';

import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:next_bank/core/ui/common_copy.dart';
import 'package:next_bank/features/pix/domain/pix_schedule.dart';
import 'package:next_bank/features/pix/presentation/schedule_texts.dart';
import 'package:next_bank/features/pix/presentation/schedules/schedules_controller.dart';

/// The customer's scheduled Pix (v1.2.0 plan, task 7; D11), opened from
/// "Agendamentos" on the Home: newest first, each with when it runs next.
class SchedulesScreen extends ConsumerWidget {
  /// Creates the list; the router says where each choice goes.
  const new({
    required this.onBack,
    required this.onSchedule,
    required this.onNew,
    super.key,
  });

  /// Back to the Home.
  final VoidCallback onBack;

  /// Opens the schedule of the given id.
  final ValueChanged<String> onSchedule;

  /// Opens the Pix screen, where a Pix is scheduled.
  final VoidCallback onNew;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final schedules = ref.watch(schedulesProvider);
    return Scaffold(
      body: GlowBackground(
        child: SafeArea(
          child: RefreshIndicator(
            onRefresh: () => ref.read(schedulesProvider.notifier).refresh(),
            child: ListView(
              padding: const EdgeInsets.all(NbSpace.screen),
              children: [
                ScreenHeader(
                  title: 'Agendamentos',
                  icon: Icons.arrow_back,
                  iconLabel: 'Voltar',
                  onPressed: onBack,
                ),
                const SizedBox(height: NbSpace.xl),
                ...switch (schedules) {
                  AsyncData(value: final view) when view.items.isEmpty => [
                    const EmptyState(
                      icon: Icons.event_outlined,
                      title: 'Nenhum Pix agendado',
                      message:
                          'Para agendar, comece um Pix e toque em "Agendar" '
                          'depois de escolher para quem.',
                    ),
                    const SizedBox(height: NbSpace.xl),
                    SecondaryButton(label: 'Agendar um Pix', onPressed: onNew),
                  ],
                  AsyncData(value: final view) => [
                    for (final schedule in view.items)
                      _ScheduleRow(
                        schedule: schedule,
                        onTap: () => onSchedule(schedule.id),
                      ),
                    ..._more(ref, view),
                  ],
                  AsyncError() => [
                    ErrorState(
                      retryLabel: CommonCopy.retry,
                      message: 'Não foi possível carregar os agendamentos.',
                      onRetry: () => ref.invalidate(schedulesProvider),
                    ),
                  ],
                  _ => const [
                    Center(
                      child: CircularProgressIndicator(
                        semanticsLabel: 'Carregando os agendamentos',
                      ),
                    ),
                  ],
                },
              ],
            ),
          ),
        ),
      ),
    );
  }

  List<Widget> _more(WidgetRef ref, SchedulesView view) => [
    if (view.loadMoreError case final error?) ...[
      const SizedBox(height: NbSpace.md),
      FormErrorText(error),
    ],
    if (view.hasMore) ...[
      const SizedBox(height: NbSpace.lg),
      SecondaryButton(
        label: 'Ver mais',
        onPressed: view.loadingMore
            ? null
            : () => unawaited(ref.read(schedulesProvider.notifier).loadMore()),
      ),
    ],
  ];
}

/// One schedule: who receives, how much, and when it runs next or that it
/// ended.
class _ScheduleRow extends StatelessWidget {
  const new({required this.schedule, required this.onTap});

  final PixSchedule schedule;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final text = context.nbText;
    final reais = formatReais(schedule.amountCents).full;
    final caption = scheduleCaption(schedule);
    final badge = scheduleBadge(schedule.status);
    return Semantics(
      container: true,
      button: true,
      label: [
        schedule.payee.name,
        reais,
        caption,
        if (badge != null) badge.$2,
      ].join(', '),
      excludeSemantics: true,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(NbRadius.field),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: NbSpace.md),
          child: Row(
            spacing: NbSpace.md,
            children: [
              const Icon(Icons.event_repeat_outlined),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  spacing: NbSpace.xs,
                  children: [
                    Text(schedule.payee.name, style: text.bodyStrong),
                    Text(caption, style: text.caption),
                    if (badge != null)
                      StatusBadge(tone: badge.$1, label: badge.$2),
                  ],
                ),
              ),
              Text(reais, style: text.bodyStrong),
            ],
          ),
        ),
      ),
    );
  }
}
