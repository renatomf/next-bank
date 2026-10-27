import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:next_bank/core/api_failure.dart';
import 'package:next_bank/core/api_messages.dart';
import 'package:next_bank/core/clock.dart';
import 'package:next_bank/core/idempotency_key.dart';
import 'package:next_bank/core/profile/profile_controller.dart';
import 'package:next_bank/core/session/session_controller.dart';
import 'package:next_bank/features/pix/domain/pix_schedule.dart';
import 'package:next_bank/features/pix/domain/pix_transfer.dart';
import 'package:next_bank/features/pix/presentation/pix_providers.dart';

/// What the Pix screen hands "Agendar": plain values, so the same Pix finds
/// the same scheduling.
typedef ScheduleDraft = ({
  PixKeyRef key,
  String payeeName,
  String payeeDetail,
  int amountCents,
  String? description,
});

/// Fewest and most times a monthly Pix runs (v1.2.0 plan, S2).
const int minMonthlyTimes = 2;

/// Most times a monthly Pix runs.
const int maxMonthlyTimes = 24;

/// How far ahead the first date may be, in days (S7).
const int _maxDaysAhead = 365;

/// An attempt whose answer has not come: its request, PIN and key go again
/// together (MOB-07).
typedef PendingSchedule = ({
  CalendarDay firstDate,
  int times,
  String pin,
  String key,
});

/// The attempts without an answer, by draft (F-39). They outlive the screen:
/// a scheduling whose answer was lost may have been done, so opening the
/// same Pix again must carry the same key, and the server answers what it
/// recorded instead of scheduling twice. Only in memory, each dropped on its
/// answer, and all of them on signing out (MOB-02).
final class PendingSchedules {
  final Map<ScheduleDraft, PendingSchedule> _byDraft = {};

  /// The attempt of [draft] still without an answer, if any.
  PendingSchedule? of(ScheduleDraft draft) => _byDraft[draft];

  /// Keeps [attempt] until [draft] is answered.
  void keep(ScheduleDraft draft, PendingSchedule attempt) =>
      _byDraft[draft] = attempt;

  /// Forgets the attempt of [draft], answered.
  void drop(ScheduleDraft draft) => _byDraft.remove(draft);
}

/// One set per signed-in customer: a new session starts with none.
final Provider<PendingSchedules> pendingSchedulesProvider = Provider((ref) {
  // Signing out starts it over; loading the session on start does not.
  ref.watch(sessionProvider.select((session) => session.value is SignedOut));
  return PendingSchedules();
});

/// The text of a scheduling whose answer was lost.
const String _unknownOutcome =
    'Não conseguimos confirmar o agendamento. Tente de novo: ele não será '
    'feito duas vezes.';

/// What the scheduling shows. Never holds the PIN (MOB-02).
final class NewScheduleState {
  /// Creates the state.
  const new({
    required this.earliest,
    required this.latest,
    this.firstDate,
    this.monthly = false,
    this.times = 12,
    this.verifying = false,
    this.blocked = false,
    this.outcomeUnknown = false,
    this.error,
  });

  /// The first day that can be chosen: tomorrow (S7).
  final CalendarDay earliest;

  /// The last day that can be chosen: a year ahead.
  final CalendarDay latest;

  /// The day chosen for the first occurrence.
  final CalendarDay? firstDate;

  /// Whether it repeats every month.
  final bool monthly;

  /// How many times a monthly Pix runs, from 2 to 24.
  final int times;

  /// True while the server checks the PIN and keeps the schedule.
  final bool verifying;

  /// The PIN is locked: no PIN can be typed.
  final bool blocked;

  /// The answer was lost: only "Tentar de novo" is offered, with the same
  /// attempt (MOB-07).
  final bool outcomeUnknown;

  /// What went wrong, in the catalog's words.
  final String? error;

  /// The day of the last occurrence, once a date is chosen (S2).
  CalendarDay? get lastDate => monthly ? firstDate?.monthly(times) : firstDate;

  /// Whether the PIN can be typed.
  bool get canConfirm =>
      firstDate != null && !verifying && !blocked && !outcomeUnknown;

  NewScheduleState _with({
    CalendarDay? firstDate,
    bool? monthly,
    int? times,
    bool verifying = false,
    bool blocked = false,
    bool outcomeUnknown = false,
    String? error,
  }) => NewScheduleState(
    earliest: earliest,
    latest: latest,
    firstDate: firstDate ?? this.firstDate,
    monthly: monthly ?? this.monthly,
    times: times ?? this.times,
    verifying: verifying,
    blocked: blocked,
    outcomeUnknown: outcomeUnknown,
    error: error,
  );
}

/// The scheduling of one draft, discarded when the screen closes, and with
/// it the PIN of an unanswered attempt.
final NotifierProvider<NewScheduleController, NewScheduleState> Function(
  ScheduleDraft,
)
newScheduleControllerProvider = NotifierProvider.autoDispose
    .family<NewScheduleController, NewScheduleState, ScheduleDraft>(
      NewScheduleController.new,
    );

/// Schedules a Pix with the PIN checked on the server (D10), as a top-up
/// is confirmed: one key per new attempt, the same key for a lost answer,
/// so a Pix is never scheduled twice (ADR 0007, MOB-07).
class NewScheduleController extends Notifier<NewScheduleState> {
  /// Creates the controller of the [draft].
  new(this.draft);

  /// What is being scheduled.
  final ScheduleDraft draft;

  @override
  NewScheduleState build() {
    // The device's day bounds the calendar only; the server decides (S7).
    final today = CalendarDay.of(ref.read(nowProvider)());
    final empty = NewScheduleState(
      earliest: today.plusDays(1),
      latest: today.plusDays(_maxDaysAhead),
    );
    // Opened again with an answer still lost: only the same attempt (F-39).
    final pending = ref.watch(pendingSchedulesProvider).of(draft);
    if (pending == null) return empty;
    return empty._with(
      firstDate: pending.firstDate,
      monthly: pending.times > 1,
      times: pending.times > 1 ? pending.times : null,
      outcomeUnknown: true,
      error: _unknownOutcome,
    );
  }

  bool get _busy => state.verifying || state.blocked || state.outcomeUnknown;

  /// Chooses the first date; a day outside tomorrow to a year ahead is
  /// ignored.
  void pickDate(CalendarDay day) {
    if (_busy ||
        day.compareTo(state.earliest) < 0 ||
        day.isAfter(state.latest)) {
      return;
    }
    state = state._with(firstDate: day);
  }

  /// Repeats every month, or runs once.
  void setMonthly({required bool monthly}) {
    if (_busy) return;
    state = state._with(monthly: monthly);
  }

  /// How many times a monthly Pix runs, kept from 2 to 24.
  void setTimes(int times) {
    if (_busy) return;
    state = state._with(times: times.clamp(minMonthlyTimes, maxMonthlyTimes));
  }

  /// Schedules with a newly typed [pin], under a new key. Ignored without a
  /// date, while a scheduling runs, after the PIN was locked and while an
  /// earlier attempt has no answer.
  Future<PixSchedule?> confirm(String pin) {
    final firstDate = state.firstDate;
    if (firstDate == null || !state.canConfirm) return Future.value();
    return _schedule((
      firstDate: firstDate,
      times: state.monthly ? state.times : 1,
      pin: pin,
      key: ref.read(idempotencyKeysProvider)(),
    ));
  }

  /// Repeats the attempt whose answer was lost, with its PIN and key, so the
  /// server answers with what it recorded. Null when there is none.
  Future<PixSchedule?> retry() {
    final pending = ref.read(pendingSchedulesProvider).of(draft);
    if (pending == null || state.verifying) return Future.value();
    return _schedule(pending);
  }

  Future<PixSchedule?> _schedule(PendingSchedule attempt) async {
    // Read now: the answer may come after the screen closed, and what it
    // decides about the attempt must still happen.
    final pending = ref.read(pendingSchedulesProvider)..keep(draft, attempt);
    state = state._with(verifying: true);
    try {
      final done = await ref
          .read(pixScheduleRepositoryProvider)
          .create(
            key: draft.key,
            amountCents: draft.amountCents,
            description: draft.description,
            firstDate: attempt.firstDate,
            times: attempt.times,
            pin: attempt.pin,
            idempotencyKey: attempt.key,
          );
      pending.drop(draft);
      if (!ref.mounted) return null;
      state = state._with();
      return done;
    } on ApiFailure catch (failure) {
      final unknown = _outcomeUnknown(failure);
      if (!unknown) pending.drop(draft);
      if (!ref.mounted) return null;
      // Catalog: the account has no PIN; the profile read again sends the
      // router to the PIN creation.
      if (failure case ApiRejected(code: ApiErrorCode.pinNotCreated)) {
        ref.invalidate(profileProvider);
      }
      state = unknown
          ? state._with(outcomeUnknown: true, error: _unknownOutcome)
          : state._with(blocked: _locked(failure), error: messageFor(failure));
      return null;
    }
  }
}

/// Whether the server may have scheduled it without the app knowing.
bool _outcomeUnknown(ApiFailure failure) => switch (failure) {
  ApiUnreachable() || ApiUnexpected() => true,
  ApiRejected(code: ApiErrorCode.requestInProgress) => true,
  ApiRejected() => false,
};

bool _locked(ApiFailure failure) => switch (failure) {
  ApiRejected(code: ApiErrorCode.pinLocked || ApiErrorCode.pinResetRequired) =>
    true,
  _ => false,
};
