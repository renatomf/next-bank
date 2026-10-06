import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';

/// Answers every request with a fixed response, or fails like a network error.
class FakeAdapter implements HttpClientAdapter {
  new respond(
    this.statusCode,
    Map<String, Object?> body, {
    this.contentType = 'application/json',
  }) : body = jsonEncode(body),
       networkError = false;

  new networkError()
    : statusCode = 0,
      body = '',
      contentType = 'application/json',
      networkError = true;

  final int statusCode;
  final String body;
  final String contentType;
  final bool networkError;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    if (networkError) {
      throw DioException.connectionError(
        requestOptions: options,
        reason: 'connection refused',
      );
    }
    return ResponseBody.fromString(
      body,
      statusCode,
      headers: {
        Headers.contentTypeHeader: [contentType],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}
