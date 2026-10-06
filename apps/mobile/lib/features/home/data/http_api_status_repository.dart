import 'package:dio/dio.dart';
import 'package:next_bank/features/home/domain/api_status.dart';
import 'package:nextbank_api/nextbank_api.dart';

/// Checks `GET /health` through the generated client.
class HttpApiStatusRepository implements ApiStatusRepository {
  /// Creates a repository backed by the generated `DefaultApi`.
  const new(this._api);

  final DefaultApi _api;

  @override
  Future<ApiStatus> check() async {
    try {
      final response = await _api.getHealth();
      return response.data?.status == HealthStatusEnum.ok
          ? ApiStatus.available
          : ApiStatus.unavailable;
    } on DioException {
      // 503, timeout or no connection: the API is not usable right now.
      return ApiStatus.unavailable;
    }
  }
}
