import 'package:design_system/src/theme/theme.dart';
import 'package:design_system/src/tokens/tokens.dart';
import 'package:flutter/material.dart';

/// One destination of the [NbNavBar].
typedef NavDestination = ({IconData icon, String label});

/// The main action of the [NbNavBar]: any widget as its icon, such as the Pix
/// symbol (week 8 plan, V6).
typedef NavAction = ({Widget icon, String label});

/// The app's navigation, docked at the bottom above the phone's own buttons
/// (week 8 plan, V4): every destination with its label under the icon, the
/// current one on a pill and told to screen readers, and the main action in
/// the middle. Docked, it never covers the screen above it.
class NbNavBar extends StatelessWidget {
  /// Creates the bar: [leading] before the action and [trailing] after it.
  const new({
    required this.leading,
    required this.trailing,
    required this.action,
    required this.selectedIndex,
    required this.onSelected,
    required this.onAction,
    super.key,
  });

  /// Destinations before the action.
  final List<NavDestination> leading;

  /// Destinations after the action.
  final List<NavDestination> trailing;

  /// The main action in the middle, e.g. the Pix.
  final NavAction action;

  /// The current destination, counted across [leading] then [trailing];
  /// null when none is.
  final int? selectedIndex;

  /// Called with the index of the destination tapped.
  final ValueChanged<int> onSelected;

  /// Called when the main action is tapped.
  final VoidCallback onAction;

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;
    Widget item(NavDestination destination, int index) => Expanded(
      child: _Destination(
        destination: destination,
        selected: index == selectedIndex,
        onTap: () => onSelected(index),
      ),
    );
    // Transparent Material for the ink; the gradient, in the theme's tones,
    // runs down behind the phone's own buttons (week 8 plan, V15).
    return Material(
      type: MaterialType.transparency,
      child: DecoratedBox(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [colors.surface2, colors.background],
          ),
          border: Border(top: BorderSide(color: colors.border)),
        ),
        // The phone's own buttons stay below, as in any app.
        child: SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: NbSpace.xs,
              vertical: NbSpace.sm,
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                for (final (i, destination) in leading.indexed)
                  item(destination, i),
                Expanded(
                  child: _Action(action: action, onTap: onAction),
                ),
                for (final (i, destination) in trailing.indexed)
                  item(destination, leading.length + i),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Icon over its label, the shape every item of the bar shares.
class _Item extends StatelessWidget {
  const new({
    required this.label,
    required this.onTap,
    required this.icon,
    required this.labelColor,
    this.selected,
  });

  final String label;
  final VoidCallback onTap;
  final Widget icon;
  final Color labelColor;
  final bool? selected;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      container: true,
      button: true,
      selected: selected,
      label: label,
      excludeSemantics: true,
      child: InkResponse(
        onTap: onTap,
        radius: 32,
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: NbSize.touch),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              icon,
              const SizedBox(height: NbSpace.xs),
              Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.center,
                style: NbType.caption.copyWith(color: labelColor),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Destination extends StatelessWidget {
  const new({
    required this.destination,
    required this.selected,
    required this.onTap,
  });

  final NavDestination destination;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;
    return _Item(
      label: destination.label,
      onTap: onTap,
      selected: selected,
      // The pill and the label's weight tell the current one, not color alone.
      labelColor: selected ? colors.text : colors.textMuted,
      icon: Container(
        width: 56,
        height: 32,
        decoration: BoxDecoration(
          color: selected ? colors.surface2 : null,
          borderRadius: BorderRadius.circular(NbRadius.pill),
        ),
        child: Icon(
          destination.icon,
          size: 24,
          color: selected ? colors.text : colors.textMuted,
        ),
      ),
    );
  }
}

class _Action extends StatelessWidget {
  const new({required this.action, required this.onTap});

  final NavAction action;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;
    return _Item(
      label: action.label,
      onTap: onTap,
      labelColor: colors.text,
      // The same 32 high as the destinations' pills, so the labels line up.
      icon: SizedBox.square(
        dimension: 32,
        child: Center(
          child: IconTheme.merge(
            data: IconThemeData(size: 28, color: colors.accent),
            child: action.icon,
          ),
        ),
      ),
    );
  }
}
