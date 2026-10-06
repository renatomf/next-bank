import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:next_bank/core/api_config.dart';
import 'package:nextbank_api/nextbank_api.dart';

/// Generated API client (ADR 0008), shared by every feature.
final apiProvider = Provider<NextbankApi>((ref) {
  final dio = Dio(
    BaseOptions(
      baseUrl: apiBaseUrl.toString(),
      connectTimeout: const Duration(seconds: 5),
      receiveTimeout: const Duration(seconds: 10),
    ),
  );
  return NextbankApi(dio: dio);
});
