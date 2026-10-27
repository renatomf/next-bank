// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'pix_schedule_page.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$PixSchedulePageCWProxy {
  PixSchedulePage items(List<PixSchedule> items);

  PixSchedulePage nextCursor(String? nextCursor);

  /// Creates a new instance with the provided field values.
  /// Omitted fields keep their values; explicit `null` clears nullable fields.
  /// The public API rejects `null` for non-nullable fields. To update a single field use `PixSchedulePage(...).copyWith.fieldName(value)`.
  ///
  /// Example:
  /// ```dart
  /// PixSchedulePage(...).copyWith(id: 12, name: "My name")
  /// ```
  PixSchedulePage call({List<PixSchedule> items, String? nextCursor});
}

/// Callable proxy for `copyWith` functionality.
/// Use as `instanceOfPixSchedulePage.copyWith(...)` or call `instanceOfPixSchedulePage.copyWith.fieldName(value)` for a single field.
class _$PixSchedulePageCWProxyImpl implements _$PixSchedulePageCWProxy {
  const _$PixSchedulePageCWProxyImpl(this._value);

  final PixSchedulePage _value;

  @override
  PixSchedulePage items(List<PixSchedule> items) => call(items: items);

  @override
  PixSchedulePage nextCursor(String? nextCursor) =>
      call(nextCursor: nextCursor);

  /// Creates a new instance with the provided field values.
  /// Omitted fields keep their values; explicit `null` clears nullable fields.
  /// The public API rejects `null` for non-nullable fields. To update a single field use `PixSchedulePage(...).copyWith.fieldName(value)`.
  ///
  /// Example:
  /// ```dart
  /// PixSchedulePage(...).copyWith(id: 12, name: "My name")
  /// ```
  @override
  PixSchedulePage call({
    Object? items = const $CopyWithPlaceholder(),
    Object? nextCursor = const $CopyWithPlaceholder(),
  }) {
    return PixSchedulePage(
      items: items == const $CopyWithPlaceholder() || items == null
          ? _value.items
          // ignore: cast_nullable_to_non_nullable
          : items as List<PixSchedule>,
      nextCursor: nextCursor == const $CopyWithPlaceholder()
          ? _value.nextCursor
          // ignore: cast_nullable_to_non_nullable
          : nextCursor as String?,
    );
  }
}

extension $PixSchedulePageCopyWith on PixSchedulePage {
  /// Returns a callable class used to build a new instance with modified fields.
  /// Example: `instanceOfPixSchedulePage.copyWith(...)` or `instanceOfPixSchedulePage.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$PixSchedulePageCWProxy get copyWith => _$PixSchedulePageCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PixSchedulePage _$PixSchedulePageFromJson(Map<String, dynamic> json) =>
    $checkedCreate('PixSchedulePage', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['items', 'nextCursor']);
      final val = PixSchedulePage(
        items: $checkedConvert(
          'items',
          (v) => (v as List<dynamic>)
              .map((e) => PixSchedule.fromJson(e as Map<String, dynamic>))
              .toList(),
        ),
        nextCursor: $checkedConvert('nextCursor', (v) => v as String?),
      );
      return val;
    });

Map<String, dynamic> _$PixSchedulePageToJson(PixSchedulePage instance) =>
    <String, dynamic>{
      'items': instance.items.map((e) => e.toJson()).toList(),
      'nextCursor': instance.nextCursor,
    };
