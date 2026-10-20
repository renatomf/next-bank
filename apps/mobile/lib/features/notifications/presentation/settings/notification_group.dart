import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';

/// One kind of notification in the settings: its title, what it is about
/// and a switch for each channel, such as the app or e-mail. Layout only
/// for now: the switches stay put and say they are coming (v1.1.0 plan,
/// task 4.6).
class NotificationGroup extends StatelessWidget {
  /// Creates the group.
  const new({
    required this.title,
    required this.description,
    required this.channels,
    required this.isOn,
    super.key,
  });

  /// The kind of notification, such as "Pix e transferências".
  final String title;

  /// What it is about.
  final String description;

  /// Where it can arrive, such as "E-mail".
  final List<String> channels;

  /// Whether its switches show as on.
  final bool isOn;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Semantics(
          header: true,
          child: Text(title, style: Theme.of(context).textTheme.titleMedium),
        ),
        const SizedBox(height: NbSpace.xs),
        Text(description, style: context.nbText.caption),
        const SizedBox(height: NbSpace.sm),
        for (final channel in channels)
          // The channel's name is read with its switch.
          MergeSemantics(
            child: Row(
              children: [
                Expanded(child: Text(channel, style: context.nbText.bodyText)),
                // A little smaller than Material's, at the developer's
                // request; scaling keeps the touch area.
                Transform.scale(
                  scale: 0.8,
                  child: Switch(
                    value: isOn,
                    onChanged: (_) => showNbToast(
                      context,
                      'Em breve.',
                      icon: Icons.info_outline,
                    ),
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}
