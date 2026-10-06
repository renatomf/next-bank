/// Whether the app can reach a healthy API.
enum ApiStatus {
  /// The API answered its health check.
  available,

  /// The API is down, unhealthy or unreachable.
  unavailable,
}

/// Checks the API health.
abstract interface class ApiStatusRepository {
  /// Reports the current API status. Never throws for network failures.
  Future<ApiStatus> check();
}
