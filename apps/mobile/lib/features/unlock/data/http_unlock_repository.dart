import 'package:dio/dio.dart';
import 'package:next_bank/core/api_failure.dart';
import 'package:next_bank/features/unlock/domain/unlock_repository.dart';
import 'package:nextbank_api/nextbank_api.dart';

/// [UnlockRepository] over the generated API client (ADR 0008):
/// `POST /v1/me/pin/verify`, on the same attempt counter as the Pix (PIX-05).
class HttpUnlockRepository implements UnlockRepository {
  /// Creates the repository on top of the generated client.
  new(this._api);

  final DefaultApi _api;

  @override
  Future<void> verifyPin(String pin) async {
    try {
      await _api.verifyPin(
        verifyPinRequestInput: VerifyPinRequestInput(pin: pin),
      );
    } on DioException catch (error) {
      throw apiFailureOf(error);
    }
  }
}
