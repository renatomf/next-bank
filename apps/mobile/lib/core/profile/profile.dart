/// What the signed-in customer sees about themselves.
final class Profile {
  /// Creates the profile.
  const new({required this.name, required this.hasPin});

  /// The customer's name, as registered.
  final String name;

  /// False while the registration still needs the transaction PIN.
  final bool hasPin;

  /// The same profile once the PIN exists.
  Profile withPin() => Profile(name: name, hasPin: true);
}
