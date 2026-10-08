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
