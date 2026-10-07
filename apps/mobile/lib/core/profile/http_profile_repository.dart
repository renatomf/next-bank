import 'package:dio/dio.dart';
import 'package:next_bank/core/api_failure.dart';
import 'package:next_bank/core/profile/profile.dart';
import 'package:next_bank/core/profile/profile_repository.dart';
import 'package:nextbank_api/nextbank_api.dart';

/// [ProfileRepository] over the generated API client (ADR 0008). The client
/// checks the answer before use: a missing field is an error, not a guess.
class HttpProfileRepository implements ProfileRepository {
  /// Creates the repository on top of the generated client.
  new(this._api);

  final DefaultApi _api;

  @override
  Future<Profile> fetch() async {
    try {
      final me = (await _api.getMe()).data!;
      return Profile(name: me.name, hasPin: me.hasPin);
    } on DioException catch (error) {
      throw apiFailureOf(error);
    }
  }
}
