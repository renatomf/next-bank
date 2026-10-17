/// What the signed-in customer sees about themselves.
final class Profile {
  /// Creates the profile.
  const new({required this.name, required this.hasPin, this.cpfMasked});

  /// The customer's name, as registered.
  final String name;

  /// The CPF masked by the server ("***.456.789-**"): never the full one.
  final String? cpfMasked;

  /// False while the registration still needs the transaction PIN.
  final bool hasPin;

  /// The same profile once the PIN exists.
  Profile withPin() => Profile(name: name, cpfMasked: cpfMasked, hasPin: true);
}
