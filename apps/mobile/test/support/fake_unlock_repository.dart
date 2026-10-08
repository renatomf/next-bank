import 'package:next_bank/features/unlock/domain/unlock_repository.dart';

/// The PIN check without the API: records each PIN it was asked to verify.
class FakeUnlockRepository implements UnlockRepository {
  /// What the next checks do; by default the PIN is right.
  Future<void> Function() answer = () async {};

  /// PINs verified, in order.
  final List<String> pins = [];

  @override
  Future<void> verifyPin(String pin) {
    pins.add(pin);
    return answer();
  }
}
