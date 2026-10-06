// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'auth_tokens.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$AuthTokensCWProxy {
  AuthTokens tokenType(AuthTokensTokenTypeEnum tokenType);

  AuthTokens accessToken(String accessToken);

  AuthTokens accessTokenExpiresAt(DateTime accessTokenExpiresAt);

  AuthTokens refreshToken(String refreshToken);

  /// Creates a new instance with the provided field values.
  /// Omitted fields keep their values; explicit `null` clears nullable fields.
  /// The public API rejects `null` for non-nullable fields. To update a single field use `AuthTokens(...).copyWith.fieldName(value)`.
  ///
  /// Example:
  /// ```dart
  /// AuthTokens(...).copyWith(id: 12, name: "My name")
  /// ```
  AuthTokens call({
    AuthTokensTokenTypeEnum tokenType,
    String accessToken,
    DateTime accessTokenExpiresAt,
    String refreshToken,
  });
}

/// Callable proxy for `copyWith` functionality.
/// Use as `instanceOfAuthTokens.copyWith(...)` or call `instanceOfAuthTokens.copyWith.fieldName(value)` for a single field.
class _$AuthTokensCWProxyImpl implements _$AuthTokensCWProxy {
  const _$AuthTokensCWProxyImpl(this._value);

  final AuthTokens _value;

  @override
  AuthTokens tokenType(AuthTokensTokenTypeEnum tokenType) =>
      call(tokenType: tokenType);

  @override
  AuthTokens accessToken(String accessToken) => call(accessToken: accessToken);

  @override
  AuthTokens accessTokenExpiresAt(DateTime accessTokenExpiresAt) =>
      call(accessTokenExpiresAt: accessTokenExpiresAt);

  @override
  AuthTokens refreshToken(String refreshToken) =>
      call(refreshToken: refreshToken);

  /// Creates a new instance with the provided field values.
  /// Omitted fields keep their values; explicit `null` clears nullable fields.
  /// The public API rejects `null` for non-nullable fields. To update a single field use `AuthTokens(...).copyWith.fieldName(value)`.
  ///
  /// Example:
  /// ```dart
  /// AuthTokens(...).copyWith(id: 12, name: "My name")
  /// ```
  @override
  AuthTokens call({
    Object? tokenType = const $CopyWithPlaceholder(),
    Object? accessToken = const $CopyWithPlaceholder(),
    Object? accessTokenExpiresAt = const $CopyWithPlaceholder(),
    Object? refreshToken = const $CopyWithPlaceholder(),
  }) {
    return AuthTokens(
      tokenType: tokenType == const $CopyWithPlaceholder() || tokenType == null
          ? _value.tokenType
          // ignore: cast_nullable_to_non_nullable
          : tokenType as AuthTokensTokenTypeEnum,
      accessToken:
          accessToken == const $CopyWithPlaceholder() || accessToken == null
          ? _value.accessToken
          // ignore: cast_nullable_to_non_nullable
          : accessToken as String,
      accessTokenExpiresAt:
          accessTokenExpiresAt == const $CopyWithPlaceholder() ||
              accessTokenExpiresAt == null
          ? _value.accessTokenExpiresAt
          // ignore: cast_nullable_to_non_nullable
          : accessTokenExpiresAt as DateTime,
      refreshToken:
          refreshToken == const $CopyWithPlaceholder() || refreshToken == null
          ? _value.refreshToken
          // ignore: cast_nullable_to_non_nullable
          : refreshToken as String,
    );
  }
}

extension $AuthTokensCopyWith on AuthTokens {
  /// Returns a callable class used to build a new instance with modified fields.
  /// Example: `instanceOfAuthTokens.copyWith(...)` or `instanceOfAuthTokens.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$AuthTokensCWProxy get copyWith => _$AuthTokensCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

AuthTokens _$AuthTokensFromJson(Map<String, dynamic> json) =>
    $checkedCreate('AuthTokens', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'tokenType',
          'accessToken',
          'accessTokenExpiresAt',
          'refreshToken',
        ],
      );
      final val = AuthTokens(
        tokenType: $checkedConvert(
          'tokenType',
          (v) => $enumDecode(_$AuthTokensTokenTypeEnumEnumMap, v),
        ),
        accessToken: $checkedConvert('accessToken', (v) => v as String),
        accessTokenExpiresAt: $checkedConvert(
          'accessTokenExpiresAt',
          (v) => DateTime.parse(v as String),
        ),
        refreshToken: $checkedConvert('refreshToken', (v) => v as String),
      );
      return val;
    });

Map<String, dynamic> _$AuthTokensToJson(AuthTokens instance) =>
    <String, dynamic>{
      'tokenType': _$AuthTokensTokenTypeEnumEnumMap[instance.tokenType]!,
      'accessToken': instance.accessToken,
      'accessTokenExpiresAt': instance.accessTokenExpiresAt.toIso8601String(),
      'refreshToken': instance.refreshToken,
    };

const _$AuthTokensTokenTypeEnumEnumMap = {
  AuthTokensTokenTypeEnum.bearer: 'Bearer',
};
