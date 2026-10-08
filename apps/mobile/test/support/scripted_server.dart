import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';

/// What the fake server answers to one request.
sealed class Reply {
  const new();
}

/// An HTTP answer with a JSON body.
final class JsonReply extends Reply {
  const new(this.status, [this.body = const {}]);

  final int status;
  final Map<String, Object?> body;
}

/// An RFC 9457 problem with the catalog code, as the API answers errors.
final class ProblemReply extends Reply {
  const new(this.status, this.code, [this.extra = const {}]);

  final int status;
  final String code;

  /// Fields the catalog adds to some errors, such as the attempts left.
  final Map<String, Object?> extra;
}

/// No answer at all, like a dropped connection.
final class NetworkFailure extends Reply {
  const new();
}

/// A request the fake server received.
typedef ReceivedRequest = ({
  String method,
  String path,
  Map<String, dynamic> headers,
  Object? body,
});

/// Fake API: answers each request with the handler of its path and records
/// what was sent, so tests can check headers and bodies.
class ScriptedServer implements HttpClientAdapter {
  new(this.handlers);

  /// Path → answer; a handler may change its answer between calls.
  final Map<String, Future<Reply> Function(RequestOptions request)> handlers;
  final List<ReceivedRequest> received = [];

  int callsTo(String path) => received.where((r) => r.path == path).length;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    received.add((
      method: options.method,
      path: options.path,
      headers: Map.of(options.headers),
      body: options.data,
    ));
    final handler = handlers[options.path];
    if (handler == null) throw StateError('No handler for ${options.path}');
    final reply = await handler(options);
    return switch (reply) {
      NetworkFailure() => throw DioException.connectionError(
        requestOptions: options,
        reason: 'connection refused',
      ),
      JsonReply(:final status, :final body) => _json(status, body),
      ProblemReply(:final status, :final code, :final extra) =>
        ResponseBody.fromString(
          jsonEncode({
            'type': 'about:blank',
            'title': 'Error',
            'status': status,
            'code': code,
            ...extra,
          }),
          status,
          headers: {
            Headers.contentTypeHeader: ['application/problem+json'],
          },
        ),
    };
  }

  ResponseBody _json(int status, Map<String, Object?> body) =>
      ResponseBody.fromString(
        jsonEncode(body),
        status,
        headers: {
          Headers.contentTypeHeader: ['application/json'],
        },
      );

  @override
  void close({bool force = false}) {}
}

/// A valid AuthTokens answer, as the API sends it.
Map<String, Object?> authTokens(String accessToken, String refreshToken) => {
  'tokenType': 'Bearer',
  'accessToken': accessToken,
  'accessTokenExpiresAt': '2026-10-06T12:15:00.000Z',
  'refreshToken': refreshToken,
};
