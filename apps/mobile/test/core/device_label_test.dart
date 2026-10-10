import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/core/device_label.dart';

// Week 7 plan, D2: the label the Security screen shows for each session,
// from the system alone, without a new dependency.
void main() {
  for (final (system, label) in [
    ('android', 'Android'),
    ('ios', 'iOS'),
    ('windows', null),
  ]) {
    test('$system is ${label ?? 'not labelled'}', () {
      expect(deviceLabelFor(system), label);
    });
  }
}
