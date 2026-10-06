/// Whether [email] looks like an e-mail address, checked before calling the
/// API only to answer fast: the API stays the authority. Up to 254
/// characters, as the API accepts.
bool isValidEmail(String email) =>
    email.length <= 254 && _shape.hasMatch(email);

// One @, no spaces, and a dot in the domain.
final RegExp _shape = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$');
