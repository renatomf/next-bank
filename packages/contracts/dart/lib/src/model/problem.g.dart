// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'problem.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$ProblemCWProxy {
  Problem type(ProblemTypeEnum type);

  Problem title(String title);

  Problem status(int status);

  Problem code(String? code);

  Problem remainingAttempts(int? remainingAttempts);

  Problem limit(Money? limit);

  Problem remaining(Money? remaining);

  /// Creates a new instance with the provided field values.
  /// Omitted fields keep their values; explicit `null` clears nullable fields.
  /// The public API rejects `null` for non-nullable fields. To update a single field use `Problem(...).copyWith.fieldName(value)`.
  ///
  /// Example:
  /// ```dart
  /// Problem(...).copyWith(id: 12, name: "My name")
  /// ```
  Problem call({
    ProblemTypeEnum type,
    String title,
    int status,
    String? code,
    int? remainingAttempts,
    Money? limit,
    Money? remaining,
  });
}

/// Callable proxy for `copyWith` functionality.
/// Use as `instanceOfProblem.copyWith(...)` or call `instanceOfProblem.copyWith.fieldName(value)` for a single field.
class _$ProblemCWProxyImpl implements _$ProblemCWProxy {
  const _$ProblemCWProxyImpl(this._value);

  final Problem _value;

  @override
  Problem type(ProblemTypeEnum type) => call(type: type);

  @override
  Problem title(String title) => call(title: title);

  @override
  Problem status(int status) => call(status: status);

  @override
  Problem code(String? code) => call(code: code);

  @override
  Problem remainingAttempts(int? remainingAttempts) =>
      call(remainingAttempts: remainingAttempts);

  @override
  Problem limit(Money? limit) => call(limit: limit);

  @override
  Problem remaining(Money? remaining) => call(remaining: remaining);

  /// Creates a new instance with the provided field values.
  /// Omitted fields keep their values; explicit `null` clears nullable fields.
  /// The public API rejects `null` for non-nullable fields. To update a single field use `Problem(...).copyWith.fieldName(value)`.
  ///
  /// Example:
  /// ```dart
  /// Problem(...).copyWith(id: 12, name: "My name")
  /// ```
  @override
  Problem call({
    Object? type = const $CopyWithPlaceholder(),
    Object? title = const $CopyWithPlaceholder(),
    Object? status = const $CopyWithPlaceholder(),
    Object? code = const $CopyWithPlaceholder(),
    Object? remainingAttempts = const $CopyWithPlaceholder(),
    Object? limit = const $CopyWithPlaceholder(),
    Object? remaining = const $CopyWithPlaceholder(),
  }) {
    return Problem(
      type: type == const $CopyWithPlaceholder() || type == null
          ? _value.type
          // ignore: cast_nullable_to_non_nullable
          : type as ProblemTypeEnum,
      title: title == const $CopyWithPlaceholder() || title == null
          ? _value.title
          // ignore: cast_nullable_to_non_nullable
          : title as String,
      status: status == const $CopyWithPlaceholder() || status == null
          ? _value.status
          // ignore: cast_nullable_to_non_nullable
          : status as int,
      code: code == const $CopyWithPlaceholder()
          ? _value.code
          // ignore: cast_nullable_to_non_nullable
          : code as String?,
      remainingAttempts: remainingAttempts == const $CopyWithPlaceholder()
          ? _value.remainingAttempts
          // ignore: cast_nullable_to_non_nullable
          : remainingAttempts as int?,
      limit: limit == const $CopyWithPlaceholder()
          ? _value.limit
          // ignore: cast_nullable_to_non_nullable
          : limit as Money?,
      remaining: remaining == const $CopyWithPlaceholder()
          ? _value.remaining
          // ignore: cast_nullable_to_non_nullable
          : remaining as Money?,
    );
  }
}

extension $ProblemCopyWith on Problem {
  /// Returns a callable class used to build a new instance with modified fields.
  /// Example: `instanceOfProblem.copyWith(...)` or `instanceOfProblem.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$ProblemCWProxy get copyWith => _$ProblemCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Problem _$ProblemFromJson(Map<String, dynamic> json) =>
    $checkedCreate('Problem', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['type', 'title', 'status']);
      final val = Problem(
        type: $checkedConvert(
          'type',
          (v) => $enumDecode(_$ProblemTypeEnumEnumMap, v),
        ),
        title: $checkedConvert('title', (v) => v as String),
        status: $checkedConvert('status', (v) => (v as num).toInt()),
        code: $checkedConvert('code', (v) => v as String?),
        remainingAttempts: $checkedConvert(
          'remainingAttempts',
          (v) => (v as num?)?.toInt(),
        ),
        limit: $checkedConvert(
          'limit',
          (v) => v == null ? null : Money.fromJson(v as Map<String, dynamic>),
        ),
        remaining: $checkedConvert(
          'remaining',
          (v) => v == null ? null : Money.fromJson(v as Map<String, dynamic>),
        ),
      );
      return val;
    });

Map<String, dynamic> _$ProblemToJson(Problem instance) => <String, dynamic>{
  'type': _$ProblemTypeEnumEnumMap[instance.type]!,
  'title': instance.title,
  'status': instance.status,
  'code': ?instance.code,
  'remainingAttempts': ?instance.remainingAttempts,
  'limit': ?instance.limit?.toJson(),
  'remaining': ?instance.remaining?.toJson(),
};

const _$ProblemTypeEnumEnumMap = {
  ProblemTypeEnum.aboutColonBlank: 'about:blank',
};
