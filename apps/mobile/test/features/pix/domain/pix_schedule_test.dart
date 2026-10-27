import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/features/pix/domain/pix_schedule.dart';

// A day as the API speaks it (YYYY-MM-DD), with no time nor zone, and the
// dates a monthly schedule falls on (v1.2.0 plan, task 7, S2).
void main() {
  group('CalendarDay', () {
    test('reads and writes the text the API speaks', () {
      final day = CalendarDay.parse('2026-11-05');

      expect(day, const CalendarDay(2026, 11, 5));
      expect(day.iso, '2026-11-05');
      expect(const CalendarDay(2027, 1, 9).iso, '2027-01-09');
    });

    test('refuses anything but a real day', () {
      for (final text in ['2026-13-01', '2026-02-30', '05/11/2026', '']) {
        expect(() => CalendarDay.parse(text), throwsFormatException);
      }
    });

    test('is the day of a local instant, whatever its time', () {
      expect(
        CalendarDay.of(DateTime(2026, 10, 27, 23, 59)),
        const CalendarDay(2026, 10, 27),
      );
    });

    test('moves by days across months and years', () {
      expect(
        const CalendarDay(2026, 12, 31).plusDays(1),
        const CalendarDay(2027, 1, 1),
      );
      expect(
        const CalendarDay(2026, 10, 27).plusDays(365),
        const CalendarDay(2027, 10, 27),
      );
    });

    test('orders days', () {
      expect(
        const CalendarDay(
          2026,
          11,
          5,
        ).compareTo(const CalendarDay(2026, 12, 1)),
        isNegative,
      );
      expect(
        const CalendarDay(2026, 11, 5).isAfter(const CalendarDay(2026, 11, 4)),
        isTrue,
      );
    });

    // S2: the first date's day each month, counted from it, or the last day
    // of a shorter month.
    test('falls on the same day each month, or the last of a shorter one', () {
      const first = CalendarDay(2027, 1, 31);

      expect([1, 2, 3, 4].map(first.monthly).toList(), const [
        CalendarDay(2027, 1, 31),
        CalendarDay(2027, 2, 28),
        CalendarDay(2027, 3, 31),
        CalendarDay(2027, 4, 30),
      ]);
      expect(
        const CalendarDay(2027, 1, 29).monthly(14),
        const CalendarDay(2028, 2, 29),
      );
    });
  });
}
