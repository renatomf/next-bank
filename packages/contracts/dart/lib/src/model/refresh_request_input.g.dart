// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'refresh_request_input.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$RefreshRequestInputCWProxy {
  RefreshRequestInput refreshToken(String refreshToken);

  /// Creates a new instance with the provided field values.
  /// Omitted fields keep their values; explicit `null` clears nullable fields.
  /// The public API rejects `null` for non-nullable fields. To update a single field use `RefreshRequestInput(...).copyWith.fieldName(value)`.
  ///
  /// Example:
  /// ```dart
  /// RefreshRequestInput(...).copyWith(id: 12, name: "My name")
  /// ```
  RefreshRequestInput call({String refreshToken});
}

/// Callable proxy for `copyWith` functionality.
/// Use as `instanceOfRefreshRequestInput.copyWith(...)` or call `instanceOfRefreshRequestInput.copyWith.fieldName(value)` for a single field.
class _$RefreshRequestInputCWProxyImpl implements _$RefreshRequestInputCWProxy {
  const _$RefreshRequestInputCWProxyImpl(this._value);

  final RefreshRequestInput _value;

  @override
  RefreshRequestInput refreshToken(String refreshToken) =>
      call(refreshToken: refreshToken);

  /// Creates a new instance with the provided field values.
  /// Omitted fields keep their values; explicit `null` clears nullable fields.
  /// The public API rejects `null` for non-nullable fields. To update a single field use `RefreshRequestInput(...).copyWith.fieldName(value)`.
  ///
  /// Example:
  /// ```dart
  /// RefreshRequestInput(...).copyWith(id: 12, name: "My name")
  /// ```
  @override
  RefreshRequestInput call({
    Object? refreshToken = const $CopyWithPlaceholder(),
  }) {
    return RefreshRequestInput(
      refreshToken:
          refreshToken == const $CopyWithPlaceholder() || refreshToken == null
          ? _value.refreshToken
          // ignore: cast_nullable_to_non_nullable
          : refreshToken as String,
    );
  }
}

extension $RefreshRequestInputCopyWith on RefreshRequestInput {
  /// Returns a callable class used to build a new instance with modified fields.
  /// Example: `instanceOfRefreshRequestInput.copyWith(...)` or `instanceOfRefreshRequestInput.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$RefreshRequestInputCWProxy get copyWith =>
      _$RefreshRequestInputCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

RefreshRequestInput _$RefreshRequestInputFromJson(Map<String, dynamic> json) =>
    $checkedCreate('RefreshRequestInput', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['refreshToken']);
      final val = RefreshRequestInput(
        refreshToken: $checkedConvert('refreshToken', (v) => v as String),
      );
      return val;
    });

Map<String, dynamic> _$RefreshRequestInputToJson(
  RefreshRequestInput instance,
) => <String, dynamic>{'refreshToken': instance.refreshToken};
