/// "Bom dia" before noon, "Boa tarde" before 18 h, "Boa noite" after.
String greetingFor(DateTime now) => switch (now.hour) {
  >= 5 && < 12 => 'Bom dia,',
  >= 12 && < 18 => 'Boa tarde,',
  _ => 'Boa noite,',
};
