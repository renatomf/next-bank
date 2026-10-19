import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';

/// The top of the Home: the profile icon and the customer's first name,
/// which open the profile (v1.1.0 plan, task 4.4), and the logo (week 8
/// plan, V8).
class GreetingHeader extends StatelessWidget {
  /// Creates the header for [firstName].
  const new({required this.firstName, required this.onProfile, super.key});

  /// The customer's first name.
  final String firstName;

  /// Opens the profile.
  final VoidCallback onProfile;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        // The link hugs the icon and the name, so the empty room up to the
        // logo is not part of it.
        Expanded(
          child: Align(
            alignment: Alignment.centerLeft,
            child: _ProfileLink(firstName: firstName, onTap: onProfile),
          ),
        ),
        const SizedBox(width: NbSpace.md),
        const NextLogo(size: 24),
      ],
    );
  }
}

class _ProfileLink extends StatelessWidget {
  const new({required this.firstName, required this.onTap});

  final String firstName;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;

    return Semantics(
      container: true,
      button: true,
      label: 'Abrir perfil',
      onTap: onTap,
      excludeSemantics: true,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(NbSize.touch / 2),
        // The icon is 44 high; the link takes the 48 of a touch target.
        child: ConstrainedBox(
          constraints: const BoxConstraints(
            minHeight: kMinInteractiveDimension,
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const _ProfileIcon(),
              const SizedBox(width: NbSpace.md),
              Flexible(
                child: Text(
                  firstName,
                  style: NbType.bodyStrong.copyWith(color: colors.text),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const SizedBox(width: NbSpace.sm),
            ],
          ),
        ),
      ),
    );
  }
}

class _ProfileIcon extends StatelessWidget {
  const new();

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;

    return Container(
      width: NbSize.touch,
      height: NbSize.touch,
      decoration: BoxDecoration(
        color: colors.surface2,
        shape: BoxShape.circle,
        border: Border.all(color: colors.border),
      ),
      child: Icon(Icons.person_outline, color: colors.accent),
    );
  }
}
