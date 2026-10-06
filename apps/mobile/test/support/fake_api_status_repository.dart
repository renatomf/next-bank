import 'package:next_bank/features/home/domain/api_status.dart';

/// [ApiStatusRepository] that answers [status] and counts the checks.
class FakeApiStatusRepository implements ApiStatusRepository {
  new(this.status);

  ApiStatus status;
  int calls = 0;

  @override
  Future<ApiStatus> check() async {
    calls++;
    return status;
  }
}
