import 'package:next_bank/core/session/biometric_check.dart';

/// The phone's biometric prompt, weak or strong, without a face or a finger.
class FakeBiometricCheck implements BiometricCheck {
  /// Creates the check; by default the customer is recognized.
  new({this.passes = true});

  /// Whether the next prompt recognizes the customer.
  bool passes;

  /// Holds the prompt open until it completes, when set.
  Future<void>? gate;

  /// How many prompts were opened.
  int checks = 0;

  @override
  Future<bool> confirm() async {
    checks++;
    await gate;
    return passes;
  }
}
