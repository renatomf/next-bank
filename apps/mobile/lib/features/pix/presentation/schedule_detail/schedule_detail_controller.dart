import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:next_bank/core/api_failure.dart';
import 'package:next_bank/core/api_messages.dart';
import 'package:next_bank/features/pix/domain/pix_schedule.dart';
import 'package:next_bank/features/pix/presentation/pix_providers.dart';
import 'package:next_bank/features/pix/presentation/schedules/schedules_controller.dart';

/// One schedule with its occurrences as the server has it, read while its
/// screen shows it. Not retried automatically: offline, the screen offers
/// "Tentar de novo".
final FutureProvider<PixSchedule> Function(String) pixScheduleProvider =
    FutureProvider.autoDispose.family<PixSchedule, String>(
      (ref, scheduleId) =>
          ref.watch(pixScheduleRepositoryProvider).fetch(scheduleId),
      retry: (_, _) => null,
    );

/// What the cancel shows.
final class CancelScheduleState {
  /// Creates the state; the default is idle.
  const new({this.cancelling = false, this.error});

  /// True while the server cancels it.
  final bool cancelling;

  /// Why it could not be cancelled, in the catalog's words.
  final String? error;
}

/// The cancel of one schedule, discarded when its screen closes.
final NotifierProvider<CancelScheduleController, CancelScheduleState> Function(
  String,
)
cancelScheduleControllerProvider = NotifierProvider.autoDispose
    .family<CancelScheduleController, CancelScheduleState, String>(
      CancelScheduleController.new,
    );

/// Cancels a schedule (v1.2.0 plan, S6). No key and no PIN: cancelling only
/// turns off what was authorized, and the server answers a repeated cancel
/// the same.
class CancelScheduleController extends Notifier<CancelScheduleState> {
  /// Creates the controller of the schedule [scheduleId].
  new(this.scheduleId);

  /// The schedule being cancelled.
  final String scheduleId;

  @override
  CancelScheduleState build() => const CancelScheduleState();

  /// Cancels it and reads it and the list again; false when the server
  /// refused or did not answer. Ignored while a cancel runs.
  Future<bool> cancel() async {
    if (state.cancelling) return false;
    state = const CancelScheduleState(cancelling: true);
    try {
      await ref.read(pixScheduleRepositoryProvider).cancel(scheduleId);
      if (!ref.mounted) return true;
      ref
        ..invalidate(pixScheduleProvider(scheduleId))
        ..invalidate(schedulesProvider);
      state = const CancelScheduleState();
      return true;
    } on ApiFailure catch (failure) {
      if (!ref.mounted) return false;
      state = CancelScheduleState(error: messageFor(failure));
      return false;
    }
  }
}
