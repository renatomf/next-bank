import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/core/request_id_interceptor.dart';

/// Captures the outgoing request instead of sending it.
class CapturingAdapter implements HttpClientAdapter {
  final List<RequestOptions> requests = [];

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<List<int>>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requests.add(options);
    return ResponseBody.fromString(
      '{}',
      200,
      headers: {
        Headers.contentTypeHeader: ['application/json'],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

// The same id follows a request from the app to the database logs
// (CLAUDE.md, section 7). The API accepts [A-Za-z0-9-]{8,64}.
final RegExp acceptedByTheApi = RegExp(r'^[A-Za-z0-9-]{8,64}$');

void main() {
  group('RequestIdInterceptor', () {
    late CapturingAdapter adapter;
    late Dio dio;

    setUp(() {
      adapter = CapturingAdapter();
      dio = Dio()
        ..httpClientAdapter = adapter
        ..interceptors.add(RequestIdInterceptor());
    });

    test('sends an x-request-id the API accepts on every request', () async {
      await dio.get<void>('https://api.example.test/health');
      await dio.post<void>('https://api.example.test/v1/auth/login');

      for (final request in adapter.requests) {
        expect(request.headers['x-request-id'], matches(acceptedByTheApi));
      }
    });

    test('never repeats an id', () async {
      for (var i = 0; i < 200; i++) {
        await dio.get<void>('https://api.example.test/health');
      }

      final ids = adapter.requests.map((r) => r.headers['x-request-id']);
      expect(ids.toSet(), hasLength(200));
    });
  });
}
