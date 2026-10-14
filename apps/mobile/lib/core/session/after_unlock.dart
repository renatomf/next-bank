import 'package:flutter_riverpod/flutter_riverpod.dart';

/// The screen a shortcut on the Unlock screen asked for, opened once the app
/// is unlocked (v1.1.0 plan, task 2). The router takes it and clears it, so
/// the next unlock goes home again.
final NotifierProvider<AfterUnlock, String?> afterUnlockProvider =
    NotifierProvider(AfterUnlock.new);

/// Holds the route a shortcut asked for until the router uses it.
class AfterUnlock extends Notifier<String?> {
  @override
  String? build() => null;

  /// The route to open once unlocked, if a shortcut asked for one.
  String? get route => state;

  set route(String? route) => state = route;

  /// Forgets it.
  void clear() => state = null;
}
