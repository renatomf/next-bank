import 'package:design_system/design_system.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart';
import 'package:next_bank/core/api_messages.dart';

/// Tells, on top of the screen, that a refresh of [provider] failed while the
/// screen keeps what it had (week 8 plan, V1): never an error block hidden
/// behind the navigation bar. Called from a screen's build.
void toastFailedRefresh<T>(
  BuildContext context,
  WidgetRef ref,
  ProviderListenable<AsyncValue<T>> provider,
) {
  ref.listen(provider, (_, next) {
    if (next case AsyncError(:final error) when next.hasValue) {
      showNbToast(context, refreshFailureMessage(error));
    }
  });
}
