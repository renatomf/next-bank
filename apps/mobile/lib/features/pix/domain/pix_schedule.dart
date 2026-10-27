import 'package:next_bank/features/pix/domain/pix_transfer.dart';

/// A day as the API speaks it (YYYY-MM-DD): no time and no zone, so a
/// schedule's date never moves with the device's clock. Equal to another
/// day with the same fields.
extension type const CalendarDay._(({int year, int month, int day}) _fields) {
  /// Creates the day; [month] from 1 to 12.
  const new(int year, int month, int day)
    : _fields = (year: year, month: month, day: day);

  /// The day of [instant], as its own fields say.
  new of(DateTime instant) : this(instant.year, instant.month, instant.day);

  /// The day written as YYYY-MM-DD; a [FormatException] for anything else,
  /// a day that does not exist included.
  factory parse(String text) {
    final match = _iso.firstMatch(text);
    if (match == null) throw FormatException('Not a day: $text');
    final day = CalendarDay(
      int.parse(match[1]!),
      int.parse(match[2]!),
      int.parse(match[3]!),
    );
    // A day that does not exist rolls over in DateTime: it reads back changed.
    if (CalendarDay.of(day._utc) != day) {
      throw FormatException('Not a day: $text');
    }
    return day;
  }

  static final RegExp _iso = RegExp(r'^(\d{4})-(\d{2})-(\d{2})$');

  /// The year.
  int get year => _fields.year;

  /// The month, from 1 to 12.
  int get month => _fields.month;

  /// The day of the month.
  int get day => _fields.day;

  DateTime get _utc => DateTime.utc(year, month, day);

  /// The text the API speaks, YYYY-MM-DD.
  String get iso =>
      '${year.toString().padLeft(4, '0')}-'
      '${month.toString().padLeft(2, '0')}-'
      '${day.toString().padLeft(2, '0')}';

  /// The day [days] later.
  CalendarDay plusDays(int days) =>
      CalendarDay.of(_utc.add(Duration(days: days)));

  /// Negative when this day comes before [other], zero on the same day.
  int compareTo(CalendarDay other) => _utc.compareTo(other._utc);

  /// Whether this day comes after [other].
  bool isAfter(CalendarDay other) => compareTo(other) > 0;

  /// The date of occurrence [sequence] of a monthly schedule starting on
  /// this day: this day of the month, counted from it, or the last day of a
  /// shorter month (v1.2.0 plan, S2).
  CalendarDay monthly(int sequence) {
    final target = DateTime.utc(year, month + sequence - 1);
    final lastDay = DateTime.utc(target.year, target.month + 1, 0).day;
    return CalendarDay(
      target.year,
      target.month,
      day < lastDay ? day : lastDay,
    );
  }
}

/// How often a scheduled Pix runs (v1.2.0 plan, D9).
enum ScheduleFrequency {
  /// On one date.
  once,

  /// Every month, a number of times.
  monthly,

  /// A frequency a later version of the API adds.
  other,
}

/// Where a scheduled Pix is.
enum PixScheduleStatus {
  /// Waiting for its next occurrence.
  active,

  /// Every occurrence ran.
  finished,

  /// Cancelled by the customer.
  cancelled,

  /// A status a later version of the API adds.
  unknown,
}

/// One occurrence that ran, with what its Pix became.
final class ScheduleOccurrence {
  /// Creates the occurrence.
  const new({
    required this.sequence,
    required this.date,
    required this.transferId,
    required this.status,
    required this.failureReason,
  });

  /// Which occurrence, from 1.
  final int sequence;

  /// The day it was due.
  final CalendarDay date;

  /// The Pix that paid it: its receipt.
  final String transferId;

  /// Where that Pix is.
  final PixStatus status;

  /// Why it failed, only when [status] is [PixStatus.failed].
  final PixFailureReason? failureReason;
}

/// A scheduled or recurring Pix as the server recorded it (v1.2.0 plan,
/// task 7). The app shows it, never computes it.
final class PixSchedule {
  /// Creates the schedule.
  const new({
    required this.id,
    required this.status,
    required this.amountCents,
    required this.description,
    required this.payee,
    required this.firstDate,
    required this.frequency,
    required this.times,
    required this.nextOccurrenceDate,
    required this.lastOccurrenceDate,
    required this.createdAt,
    this.occurrences = const [],
  });

  /// The schedule's id.
  final String id;

  /// Where the schedule is.
  final PixScheduleStatus status;

  /// The amount of each occurrence in integer cents, always positive.
  final int amountCents;

  /// What the payer wrote, if anything.
  final String? description;

  /// Who receives, as it was when scheduled.
  final PixPayee payee;

  /// The day of the first occurrence.
  final CalendarDay firstDate;

  /// How often it runs.
  final ScheduleFrequency frequency;

  /// How many occurrences in all; 1 for a Pix scheduled once.
  final int times;

  /// The day of the next occurrence; null once it is not active.
  final CalendarDay? nextOccurrenceDate;

  /// The day of the last occurrence: where the schedule ends.
  final CalendarDay lastOccurrenceDate;

  /// When it was scheduled.
  final DateTime createdAt;

  /// What each occurrence that ran became; only in a schedule's detail.
  final List<ScheduleOccurrence> occurrences;
}

/// A page of schedules, newest first, and where the next one starts.
typedef PixSchedulePage = ({List<PixSchedule> items, String? nextCursor});
