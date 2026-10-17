/// Kinds of Pix key (domain-model.md 3.4). The app sends to CPF keys typed
/// and, since v1.1.0, to random keys read from a QR Code.
enum PixKeyType {
  /// The holder's CPF.
  cpf,

  /// An e-mail address.
  email,

  /// A phone number.
  phone,

  /// A random key.
  random,
}

/// A key to send a Pix to: its kind and its normalized value.
typedef PixKeyRef = ({PixKeyType type, String value});

/// Who receives the Pix, as the server shows it: never the full CPF.
final class PixPayee {
  /// Creates the payee.
  const new({
    required this.name,
    required this.documentMasked,
    required this.keyType,
    required this.keyMasked,
  });

  /// Full name, so the payer can tell who receives (week 5 plan, D6).
  final String name;

  /// The payee's CPF masked by the server, e.g. "***.456.789-**".
  final String documentMasked;

  /// The kind of key the Pix was sent to.
  final PixKeyType keyType;

  /// The key masked by the server.
  final String keyMasked;
}

/// Where a Pix is in its life (domain-model.md, section 4).
enum PixStatus {
  /// Created; waits for the PIN for up to 10 minutes.
  awaitingAuth,

  /// Authorized; the money is moving.
  processing,

  /// The money reached the payee.
  completed,

  /// Processed and refused; see [PixFailureReason].
  failed,

  /// Cancelled, expired or stopped by a locked PIN.
  cancelled,
}

/// Why a processed Pix failed (domain-model.md, section 9).
enum PixFailureReason {
  /// The balance no longer covered the amount.
  insufficientFunds,

  /// The amount was over the limit when it was authorized.
  limitExceeded,

  /// The payee's account cannot receive money now.
  payeeUnavailable,

  /// The payer's account cannot send money.
  accountBlocked,
}

/// A Pix as the server recorded it. The app shows it, never computes it.
final class PixTransfer {
  /// Creates the Pix.
  const new({
    required this.id,
    required this.status,
    required this.amountCents,
    required this.description,
    required this.payee,
    required this.endToEndId,
    required this.failureReason,
    required this.createdAt,
    required this.completedAt,
  });

  /// The Pix's id.
  final String id;

  /// Where the Pix is.
  final PixStatus status;

  /// The amount in integer cents, always positive (ADR 0006).
  final int amountCents;

  /// What the payer wrote, if anything.
  final String? description;

  /// Who receives, as it was when the Pix was created.
  final PixPayee payee;

  /// The end-to-end id, once the money moved.
  final String? endToEndId;

  /// Why it failed, only when [status] is [PixStatus.failed].
  final PixFailureReason? failureReason;

  /// When it was created.
  final DateTime createdAt;

  /// When the money reached the payee.
  final DateTime? completedAt;
}
