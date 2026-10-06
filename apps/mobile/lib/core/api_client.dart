import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:next_bank/core/api_config.dart';
import 'package:next_bank/core/request_id_interceptor.dart';
import 'package:next_bank/core/session/api_session_tokens.dart';
import 'package:next_bank/core/session/session_controller.dart';
import 'package:next_bank/core/session/session_interceptor.dart';
import 'package:nextbank_api/nextbank_api.dart';

Dio _newDio() => Dio(
  BaseOptions(
    baseUrl: apiBaseUrl.toString(),
    connectTimeout: const Duration(seconds: 5),
    receiveTimeout: const Duration(seconds: 10),
  ),
);

/// Generated API client (ADR 0008), shared by every feature. Interceptors are
/// listed explicitly, so the generator's generic auth interceptors never run:
/// the session interceptor is the only one that attaches tokens.
final apiProvider = Provider<NextbankApi>((ref) {
  // The refresh goes through a client without the session interceptor, so a
  // refresh can never trigger another refresh.
  final refreshApi = NextbankApi(
    dio: _newDio(),
    interceptors: [RequestIdInterceptor()],
  ).getDefaultApi();
  final session = ref.read(sessionProvider.notifier);

  final dio = _newDio();
  dio.interceptors.addAll([
    RequestIdInterceptor(),
    SessionInterceptor(
      dio: dio,
      currentTokens: () => switch (ref.read(sessionProvider).value) {
        SignedIn(:final tokens) => tokens,
        _ => null,
      },
      refresh: (refreshToken) async {
        final response = await refreshApi.refreshSession(
          refreshRequestInput: RefreshRequestInput(refreshToken: refreshToken),
        );
        return sessionTokensFrom(response.data!);
      },
      onRefreshed: session.signIn,
      onSessionEnded: session.signOut,
    ),
  ]);
  return NextbankApi(dio: dio, interceptors: []);
});
