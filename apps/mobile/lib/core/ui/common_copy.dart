/// Copy that many screens give the design system's components, which carry
/// no text of their own (ADR 0014): one place for each phrase.
abstract final class CommonCopy {
  /// The retry action of an error state.
  static const String retry = 'Tentar de novo';

  /// The way out of a confirmation.
  static const String cancel = 'Cancelar';

  /// What the screen reader says for an amount the customer hid.
  static const String hiddenBalance = 'Saldo oculto';

  /// The tag on a made-up figure of a layout-only screen (D7, revised in the
  /// v1.1.0 plan, task 6).
  static const String example = 'Exemplo';

  /// The button that shows or hides a password or a PIN.
  static const ({String show, String hide}) revealSecret = (
    show: 'Mostrar senha',
    hide: 'Ocultar senha',
  );
}
