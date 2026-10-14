const List<String> _months = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
];

/// The short Portuguese name of [month] (1 to 12), e.g. "out".
String shortMonth(int month) => _months[month - 1];

/// "09:12": hours and minutes with two digits each.
String clockTime(DateTime time) =>
    '${time.hour.toString().padLeft(2, '0')}:'
    '${time.minute.toString().padLeft(2, '0')}';

const List<String> _longMonths = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

const List<String> _weekdays = [
  'segunda-feira',
  'terça-feira',
  'quarta-feira',
  'quinta-feira',
  'sexta-feira',
  'sábado',
  'domingo',
];

/// The full Portuguese name of [month] (1 to 12), e.g. "outubro".
String longMonth(int month) => _longMonths[month - 1];

/// The Portuguese name of [weekday] ([DateTime.monday] to [DateTime.sunday]).
String weekdayName(int weekday) => _weekdays[weekday - 1];
