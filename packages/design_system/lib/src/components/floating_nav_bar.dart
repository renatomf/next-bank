import 'package:design_system/src/theme.dart';
import 'package:design_system/src/tokens.dart';
import 'package:flutter/material.dart';

/// One destination of the [FloatingNavBar].
typedef NavDestination = ({IconData icon, String label});

/// The app's floating navigation (brief, section 7; home-dark mockup): a pill
/// over the screen with the destinations, the current one on a circle, and
/// the main action in the middle as a mint circle with its halo. The current
/// destination is told by a circle and to screen readers, never by color
/// alone (brief, section 8).
class FloatingNavBar extends StatelessWidget {
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

  /// Height of the bar in the mockup.
  static const double height = 72;

  /// Destinations before the action.
  final List<NavDestination> leading;

  /// Destinations after the action.
  final List<NavDestination> trailing;

  /// The main action in the middle, e.g. the Pix.
  final NavDestination action;

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
    // Its own Material: the bar floats outside any Scaffold, and the taps'
    // ink needs one.
    return Material(
      color: colors.surface,
      shape: StadiumBorder(side: BorderSide(color: colors.border)),
      child: Container(
        height: height,
        padding: const EdgeInsets.symmetric(horizontal: NbSpace.sm),
        child: Row(
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
    return Semantics(
      container: true,
      button: true,
      selected: selected,
      label: destination.label,
      excludeSemantics: true,
      child: InkResponse(
        onTap: onTap,
        radius: 28,
        child: Center(
          child: Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              color: selected ? colors.surface2 : null,
              shape: BoxShape.circle,
            ),
            child: Icon(
              destination.icon,
              size: 24,
              color: selected ? colors.text : colors.textMuted,
            ),
          ),
        ),
      ),
    );
  }
}

class _Action extends StatelessWidget {
  const new({required this.action, required this.onTap});

  final NavDestination action;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;
    return Semantics(
      container: true,
      button: true,
      label: action.label,
      excludeSemantics: true,
      child: Center(
        child: DecoratedBox(
          decoration: const BoxDecoration(
            shape: BoxShape.circle,
            boxShadow: [
              BoxShadow(
                color: NbBrand.actionGlow,
                blurRadius: 24,
                spreadRadius: -4,
              ),
            ],
          ),
          child: Material(
            color: NbBrand.mint,
            shape: const CircleBorder(),
            clipBehavior: Clip.antiAlias,
            child: InkWell(
              onTap: onTap,
              child: SizedBox.square(
                dimension: 60,
                child: Icon(action.icon, size: 28, color: colors.background),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
