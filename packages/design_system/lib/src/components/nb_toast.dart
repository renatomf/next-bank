import 'dart:async';

import 'package:design_system/src/theme.dart';
import 'package:design_system/src/tokens.dart';
import 'package:flutter/material.dart';

/// The notice on screen, if any: a new one replaces it.
OverlayEntry? _current;

/// Shows [message] on top of everything, the navigation bar included, for
/// four seconds or until tapped (week 8 plan, V1). For what went wrong while
/// the screen keeps showing what it had, such as a failed refresh.
void showNbToast(BuildContext context, String message) {
  _current?.remove();
  late final OverlayEntry entry;
  entry = OverlayEntry(
    builder: (_) => Align(
      alignment: Alignment.topCenter,
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(NbSpace.screen),
          child: NbToast(
            message: message,
            onDismissed: () {
              if (_current == entry) _current = null;
              if (entry.mounted) entry.remove();
            },
          ),
        ),
      ),
    ),
  );
  _current = entry;
  Overlay.of(context, rootOverlay: true).insert(entry);
}

/// The notice itself: icon and message on the raised surface, at the top of
/// the screen. Announced to screen readers as it appears.
class NbToast extends StatefulWidget {
  /// Creates the notice; [onDismissed] runs when it goes away.
  const new({required this.message, required this.onDismissed, super.key});

  /// How long it stays.
  static const Duration duration = Duration(seconds: 4);

  /// What happened, in the customer's words.
  final String message;

  /// Called when it goes away, by itself or tapped.
  final VoidCallback onDismissed;

  @override
  State<NbToast> createState() => _NbToastState();
}

class _NbToastState extends State<NbToast> {
  // Cancelled when the toast goes, so nothing fires on a screen that is gone.
  late final Timer _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer(NbToast.duration, widget.onDismissed);
  }

  @override
  void dispose() {
    _timer.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;
    return Semantics(
      liveRegion: true,
      container: true,
      child: GestureDetector(
        onTap: widget.onDismissed,
        child: Material(
          color: colors.surface2,
          elevation: 6,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(NbRadius.block),
            side: BorderSide(color: colors.border),
          ),
          child: Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: NbSpace.lg,
              vertical: NbSpace.md,
            ),
            child: Row(
              children: [
                Icon(Icons.error_outline, color: colors.danger),
                const SizedBox(width: NbSpace.md),
                Expanded(
                  child: Text(
                    widget.message,
                    style: NbType.bodyText.copyWith(color: colors.text),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
